<?php
/**
 * Plugin Name: Detailing Leads
 * Description: Принимает заявки сайтов детейлинга и отправляет их на почту владельца.
 * Version: 1.0.0
 * Requires PHP: 7.4
 */

defined('ABSPATH') || exit;

final class Detailing_Leads {
    private const OPTION = 'detailing_leads_email';

    public static function boot() {
        add_action('rest_api_init', function () {
            register_rest_route('detailing/v1', '/leads', array(
                'methods' => 'POST',
                'callback' => array(__CLASS__, 'submit'),
                'permission_callback' => array(__CLASS__, 'same_origin'),
            ));
        });
        add_action('admin_init', function () {
            register_setting('detailing_leads', self::OPTION, array(
                'type' => 'string', 'sanitize_callback' => array(__CLASS__, 'sanitize_recipient'),
                'default' => '',
            ));
        });
        add_action('admin_menu', function () {
            add_options_page('Заявки детейлинга', 'Заявки детейлинга', 'manage_options', 'detailing-leads', array(__CLASS__, 'settings'));
        });
        add_action('wp_head', function () {
            echo '<script>window.DETAILING_LEAD_FORM=' . wp_json_encode(array('endpoint' => rest_url('detailing/v1/leads')), JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) . ';</script>';
        });
    }

    public static function sanitize_recipient($value) {
        if (!is_scalar($value)) { return get_option(self::OPTION, ''); }
        $email = sanitize_email($value);
        if ($email && is_email($email)) { return $email; }
        if (trim((string) $value) === '') { return ''; }
        add_settings_error(self::OPTION, 'invalid_email', 'Укажите корректный email. Предыдущее значение сохранено.');
        return get_option(self::OPTION, '');
    }

    public static function settings() {
        if (!current_user_can('manage_options')) { return; }
        echo '<div class="wrap"><h1>Заявки детейлинга</h1><form method="post" action="options.php">';
        settings_fields('detailing_leads');
        echo '<p><label for="detailing-email">Email для заявок</label></p><input class="regular-text" type="email" id="detailing-email" name="' . esc_attr(self::OPTION) . '" value="' . esc_attr(get_option(self::OPTION, '')) . '">';
        echo '<p>Если поле пустое, используется email администратора: ' . esc_html(get_option('admin_email')) . '.</p>';
        echo '<p>Проверьте отправку почты на хостинге или настройте SMTP. Успешный ответ означает, что WordPress передал письмо почтовой системе.</p>';
        echo '<p>Адрес обработчика: <code>' . esc_html(rest_url('detailing/v1/leads')) . '</code></p>';
        submit_button();
        echo '</form></div>';
    }

    private static function origin($url) {
        $parts = wp_parse_url($url);
        if (empty($parts['scheme']) || empty($parts['host'])) { return ''; }
        $scheme = strtolower($parts['scheme']);
        $port = isset($parts['port']) ? (int) $parts['port'] : ($scheme === 'https' ? 443 : 80);
        return $scheme . '://' . strtolower($parts['host']) . ':' . $port;
    }

    public static function same_origin($request) {
        $origin = $request->get_header('origin');
        if (!$origin) { return true; }
        $actual = self::origin($origin);
        if ($actual && in_array($actual, array(self::origin(home_url()), self::origin(site_url())), true)) { return true; }
        return new WP_Error('forbidden_origin', 'Отправка с этого адреса запрещена.', array('status' => 403));
    }

    private static function text($body, $key, $limit = 200) {
        if (!isset($body[$key]) || !is_scalar($body[$key])) { return ''; }
        $value = sanitize_text_field((string) $body[$key]);
        return function_exists('mb_substr') ? mb_substr($value, 0, $limit) : substr($value, 0, $limit);
    }

    public static function submit($request) {
        if (strlen($request->get_body()) > 16000) { return new WP_Error('too_large', 'Запрос слишком большой.', array('status' => 413)); }
        $body = $request->get_json_params();
        if (!is_array($body)) { return new WP_Error('invalid_body', 'Нужен JSON-запрос.', array('status' => 400)); }
        // Ловушка для ботов: такие заявки не отправляются и не получают подтверждение успеха.
        if (!empty($body['website'])) { return new WP_Error('spam', 'Не удалось отправить заявку.', array('status' => 400)); }
        $phone = self::text($body, 'phone', 40);
        $digits = preg_replace('/\D/', '', $phone);
        $car = self::text($body, 'car', 120);
        if (!$car || strlen($digits) < 10 || strlen($digits) > 15 || ($body['consent'] ?? false) !== true) {
            return new WP_Error('invalid_fields', 'Укажите автомобиль, телефон и согласие на обработку данных.', array('status' => 422));
        }
        $id = self::text($body, 'requestId', 80);
        if (!preg_match('/^[a-zA-Z0-9-]{20,80}$/', $id)) { return new WP_Error('invalid_id', 'Некорректный запрос.', array('status' => 400)); }
        $ip = isset($_SERVER['REMOTE_ADDR']) ? (string) $_SERVER['REMOTE_ADDR'] : 'unknown';
        $fingerprint = hash_hmac('sha256', $ip, wp_salt('nonce'));
        $done_key = 'dtl_done_' . hash('sha256', $fingerprint . $id);
        $done = get_transient($done_key);
        if (is_array($done)) { return rest_ensure_response($done); }
        $rate_key = 'dtl_rate_' . $fingerprint;
        $attempts = (int) get_transient($rate_key);
        if ($attempts >= 5) { return new WP_Error('rate_limit', 'Попробуйте позже или позвоните.', array('status' => 429)); }
        set_transient($rate_key, $attempts + 1, 10 * MINUTE_IN_SECONDS);
        $recipient = get_option(self::OPTION) ?: get_option('admin_email');
        if (!is_email($recipient)) { return new WP_Error('not_configured', 'Обработчик не настроен.', array('status' => 503)); }
        $studio = self::text($body, 'studio', 100);
        $zones = isset($body['zones']) && is_array($body['zones']) ? array_slice($body['zones'], 0, 12) : array();
        $zones = array_filter(array_map(function ($zone) { return self::text(array('zone' => $zone), 'zone', 80); }, $zones));
        $notes = isset($body['notes']) && is_scalar($body['notes']) ? sanitize_textarea_field((string) $body['notes']) : '';
        $notes = function_exists('mb_substr') ? mb_substr($notes, 0, 1000) : substr($notes, 0, 2000);
        $page = self::text($body, 'page', 500);
        $message = implode("\n", array(
            'Новая заявка с сайта ' . $studio,
            'Имя: ' . self::text($body, 'name', 80),
            'Телефон: ' . $phone,
            'Автомобиль: ' . $car,
            'Услуга: ' . self::text($body, 'service', 250),
            'Филиал: ' . self::text($body, 'branch', 200),
            'Направление: ' . self::text($body, 'scenario', 200),
            'Зоны: ' . implode(', ', $zones),
            'Задача: ' . $notes,
            'Страница: ' . esc_url_raw($page, array('http', 'https')),
            'Согласие на обработку данных для обратной связи: дано.',
            'Время: ' . current_time('mysql'),
            'Номер: ' . $id,
        ));
        $sent = wp_mail($recipient, 'Заявка с сайта: ' . ($studio ?: get_bloginfo('name')), $message, array('Content-Type: text/plain; charset=UTF-8'));
        if (!$sent) { return new WP_Error('mail_failed', 'Не удалось передать заявку. Позвоните в студию.', array('status' => 503)); }
        $result = array('success' => true, 'requestId' => $id);
        set_transient($done_key, $result, HOUR_IN_SECONDS);
        return rest_ensure_response($result);
    }
}

Detailing_Leads::boot();

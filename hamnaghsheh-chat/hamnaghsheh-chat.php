<?php
/**
 * Plugin Name: Hamnaghsheh Chat
 * Plugin URI:  https://hamnaghsheh.ir
 * Description: افزودن چت‌باکس به پروژه‌های همنقشه
 * Version:     1.0.0
 * Author:      Soroush Yasini
 * Text Domain: hamnaghsheh-chat
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/* -------------------------------------------------------------------------
   Constants
------------------------------------------------------------------------- */
define( 'HCHAT_DIR',     plugin_dir_path( __FILE__ ) );
define( 'HCHAT_URL',     plugin_dir_url( __FILE__ ) );
define( 'HCHAT_VERSION', '1.0.0' );

/* -------------------------------------------------------------------------
   Load all includes
------------------------------------------------------------------------- */
require_once HCHAT_DIR . 'includes/class-hchat-activator.php';
require_once HCHAT_DIR . 'includes/class-hchat-permissions.php';
require_once HCHAT_DIR . 'includes/class-hchat-messages.php';
require_once HCHAT_DIR . 'includes/class-hchat-notify.php';
require_once HCHAT_DIR . 'includes/class-hchat-ajax.php';

/* -------------------------------------------------------------------------
   Activation hook
------------------------------------------------------------------------- */
register_activation_hook( __FILE__, array( 'HChat_Activator', 'activate' ) );

/* -------------------------------------------------------------------------
   Bootstrap
------------------------------------------------------------------------- */
add_action( 'plugins_loaded', 'hchat_init' );

function hchat_init() {
	// Register AJAX handlers.
	$ajax = new HChat_Ajax();
	$ajax->register_hooks();

	// Hook into the main plugin's action to inject the widget.
	add_action( 'hamnaghsheh_after_project_content', 'hchat_render_widget', 10, 3 );

	// Enqueue assets on the front end.
	add_action( 'wp_enqueue_scripts', 'hchat_enqueue_assets' );
}

/* -------------------------------------------------------------------------
   Render the floating chat widget
------------------------------------------------------------------------- */
function hchat_render_widget( $project, $files, $members ) {
	if ( ! is_user_logged_in() ) {
		return;
	}

	$user_id = get_current_user_id();

	// Check access: owner, member, or admin.
	$is_owner  = isset( $project->user_id ) && (int) $project->user_id === (int) $user_id;
	$is_member = false;
	if ( is_array( $members ) ) {
		foreach ( $members as $m ) {
			if ( isset( $m->user_id ) && (int) $m->user_id === (int) $user_id ) {
				$is_member = true;
				break;
			}
		}
	}
	$is_admin = current_user_can( 'manage_options' );

	if ( ! $is_owner && ! $is_member && ! $is_admin ) {
		return;
	}

	// Include the template (variables $project, $files, $members are available).
	include HCHAT_DIR . 'templates/chat-widget.php';
}

/* -------------------------------------------------------------------------
   Enqueue CSS and JS
------------------------------------------------------------------------- */
function hchat_enqueue_assets() {
	if ( is_admin() ) {
		return;
	}

	wp_enqueue_style(
		'hchat-style',
		HCHAT_URL . 'assets/css/hchat.css',
		array(),
		HCHAT_VERSION
	);

	wp_enqueue_script(
		'hchat-script',
		HCHAT_URL . 'assets/js/hchat.js',
		array(),
		HCHAT_VERSION,
		true
	);

	// Determine project ID from the global post / query (best-effort).
	$project_id = 0;
	global $post;
	if ( isset( $_GET['project_id'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$project_id = absint( $_GET['project_id'] ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended
	}

	wp_localize_script(
		'hchat-script',
		'hchatConfig',
		array(
			'ajax_url'        => admin_url( 'admin-ajax.php' ),
			'nonce'           => wp_create_nonce( 'hchat_nonce' ),
			'project_id'      => $project_id,
			'current_user_id' => get_current_user_id(),
		)
	);
}

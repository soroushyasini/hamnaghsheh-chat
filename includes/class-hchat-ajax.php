<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class HChat_Ajax {

	/** @var HChat_Messages */
	private $messages;

	public function __construct() {
		$this->messages = new HChat_Messages();
	}

	/**
	 * Register all AJAX actions.
	 */
	public function register_hooks() {
		add_action( 'wp_ajax_hchat_send_message',           array( $this, 'send_message' ) );
		add_action( 'wp_ajax_hchat_get_messages',           array( $this, 'get_messages' ) );
		add_action( 'wp_ajax_hchat_load_earlier',           array( $this, 'load_earlier' ) );
		add_action( 'wp_ajax_hchat_mark_read',              array( $this, 'mark_read' ) );
		add_action( 'wp_ajax_hchat_unread_count',           array( $this, 'unread_count' ) );
		add_action( 'wp_ajax_hchat_get_project_files',      array( $this, 'ajax_get_project_files' ) );
		add_action( 'wp_ajax_hchat_get_activity',           array( $this, 'ajax_get_activity' ) );
		add_action( 'wp_ajax_hchat_load_earlier_activity',  array( $this, 'ajax_load_earlier_activity' ) );
		add_action( 'wp_ajax_hchat_mark_activity_seen',     array( $this, 'ajax_mark_activity_seen' ) );
		add_action( 'wp_ajax_hchat_activity_unseen_count',  array( $this, 'ajax_activity_unseen_count' ) );
	}

	// -------------------------------------------------------------------------
	// Helpers
	// -------------------------------------------------------------------------

	private function verify_and_get_project_id() {
		check_ajax_referer( 'hchat_nonce', 'nonce' );

		if ( ! is_user_logged_in() ) {
			wp_send_json_error( array( 'message' => 'دسترسی مجاز نیست.' ), 403 );
		}

		$project_id = isset( $_REQUEST['project_id'] ) ? absint( $_REQUEST['project_id'] ) : 0;
		if ( ! $project_id ) {
			wp_send_json_error( array( 'message' => 'شناسه پروژه نامعتبر است.' ), 400 );
		}

		$user_id = get_current_user_id();
		if ( ! HChat_Permissions::can_access( $project_id, $user_id ) ) {
			wp_send_json_error( array( 'message' => 'دسترسی به این پروژه مجاز نیست.' ), 403 );
		}

		return $project_id;
	}

	// -------------------------------------------------------------------------
	// Handlers
	// -------------------------------------------------------------------------

	public function send_message() {
		$project_id = $this->verify_and_get_project_id();
		$user_id    = get_current_user_id();

		// Rate limiting: max 1 message per 2 seconds per user.
		$rate_key = 'hchat_rate_' . $user_id;
		if ( get_transient( $rate_key ) ) {
			wp_send_json_error( array( 'message' => 'لطفاً کمی صبر کنید.' ), 429 );
		}
		set_transient( $rate_key, 1, 2 );

		$message_raw = isset( $_POST['message'] ) ? wp_unslash( $_POST['message'] ) : ''; // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
		$message     = wp_kses_post( $message_raw );
		$message     = substr( trim( $message ), 0, 1000 );

		if ( '' === $message ) {
			wp_send_json_error( array( 'message' => 'پیام خالی است.' ), 400 );
		}

		$user        = wp_get_current_user();
		$sender_name = $user->display_name ? $user->display_name : $user->user_login;

		$saved = $this->messages->save( $project_id, $user_id, $sender_name, $message );
		if ( ! $saved ) {
			wp_send_json_error( array( 'message' => 'خطا در ذخیره پیام.' ), 500 );
		}

		// Email notifications.
		$members = $this->get_project_members_for_notify( $project_id );
		if ( ! empty( $members ) ) {
			$project_name = $this->get_project_name( $project_id );
			HChat_Notify::notify_members( $project_id, $user_id, $members, $project_name );
		}

		wp_send_json_success( $saved );
	}

	public function get_messages() {
		$project_id = $this->verify_and_get_project_id();
		$after_id   = isset( $_GET['after_id'] ) ? absint( $_GET['after_id'] ) : 0;
		$messages   = $this->messages->get_after( $project_id, $after_id );
		wp_send_json_success( $messages );
	}

	public function load_earlier() {
		$project_id = $this->verify_and_get_project_id();
		$before_id  = isset( $_GET['before_id'] ) ? absint( $_GET['before_id'] ) : PHP_INT_MAX;
		$messages   = $this->messages->get_before( $project_id, $before_id );
		wp_send_json_success( $messages );
	}

	public function mark_read() {
		$project_id = $this->verify_and_get_project_id();
		$user_id    = get_current_user_id();
		$this->messages->mark_read( $project_id, $user_id );
		wp_send_json_success( array( 'marked' => true ) );
	}

	public function unread_count() {
		$project_id = $this->verify_and_get_project_id();
		$user_id    = get_current_user_id();
		$count      = $this->messages->unread_count( $project_id, $user_id );
		wp_send_json_success( array( 'count' => $count ) );
	}

	// -------------------------------------------------------------------------
	// Activity & file endpoints
	// -------------------------------------------------------------------------

	public function ajax_get_project_files() {
		check_ajax_referer( 'hchat_nonce', 'nonce' );
		if ( ! is_user_logged_in() ) {
			wp_send_json_error( 'Unauthorized', 403 );
		}
		$project_id = isset( $_GET['project_id'] ) ? absint( $_GET['project_id'] ) : 0;
		if ( ! HChat_Permissions::can_access( $project_id, get_current_user_id() ) ) {
			wp_send_json_error( 'Forbidden', 403 );
		}
		global $wpdb;
		$table = $wpdb->prefix . 'hamnaghsheh_files';
		$files = $wpdb->get_results( $wpdb->prepare(
			// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
			"SELECT id, file_name FROM {$table} WHERE project_id = %d ORDER BY uploaded_at DESC",
			$project_id
		) );
		wp_send_json_success( $files );
	}

	public function ajax_get_activity() {
		check_ajax_referer( 'hchat_nonce', 'nonce' );
		if ( ! is_user_logged_in() ) {
			wp_send_json_error( 'Unauthorized', 403 );
		}
		$project_id = isset( $_GET['project_id'] ) ? absint( $_GET['project_id'] ) : 0;
		$after_id   = isset( $_GET['after_id'] )   ? absint( $_GET['after_id'] )   : 0;
		if ( ! HChat_Permissions::can_access( $project_id, get_current_user_id() ) ) {
			wp_send_json_error( 'Forbidden', 403 );
		}
		$events = HChat_Activity::get_events( $project_id, $after_id );
		wp_send_json_success( $events );
	}

	public function ajax_load_earlier_activity() {
		check_ajax_referer( 'hchat_nonce', 'nonce' );
		if ( ! is_user_logged_in() ) {
			wp_send_json_error( 'Unauthorized', 403 );
		}
		$project_id = isset( $_GET['project_id'] ) ? absint( $_GET['project_id'] ) : 0;
		$before_id  = isset( $_GET['before_id'] )  ? absint( $_GET['before_id'] )  : 0;
		if ( ! HChat_Permissions::can_access( $project_id, get_current_user_id() ) ) {
			wp_send_json_error( 'Forbidden', 403 );
		}
		$events = HChat_Activity::get_events_before( $project_id, $before_id );
		wp_send_json_success( $events );
	}

	public function ajax_mark_activity_seen() {
		check_ajax_referer( 'hchat_nonce', 'nonce' );
		if ( ! is_user_logged_in() ) {
			wp_send_json_error( 'Unauthorized', 403 );
		}
		$project_id  = isset( $_POST['project_id'] )  ? absint( $_POST['project_id'] )  : 0;
		$last_log_id = isset( $_POST['last_log_id'] ) ? absint( $_POST['last_log_id'] ) : 0;
		if ( ! HChat_Permissions::can_access( $project_id, get_current_user_id() ) ) {
			wp_send_json_error( 'Forbidden', 403 );
		}
		HChat_Activity::mark_seen( $project_id, get_current_user_id(), $last_log_id );
		wp_send_json_success();
	}

	public function ajax_activity_unseen_count() {
		check_ajax_referer( 'hchat_nonce', 'nonce' );
		if ( ! is_user_logged_in() ) {
			wp_send_json_error( 'Unauthorized', 403 );
		}
		$project_id = isset( $_GET['project_id'] ) ? absint( $_GET['project_id'] ) : 0;
		if ( ! HChat_Permissions::can_access( $project_id, get_current_user_id() ) ) {
			wp_send_json_error( 'Forbidden', 403 );
		}
		$count = HChat_Activity::get_unseen_count( $project_id, get_current_user_id() );
		wp_send_json_success( array( 'count' => $count ) );
	}

	// -------------------------------------------------------------------------
	// Private helpers
	// -------------------------------------------------------------------------

	/**
	 * Build a minimal array of member objects for notification use.
	 *
	 * @param int $project_id
	 * @return array
	 */
	private function get_project_members_for_notify( $project_id ) {
		global $wpdb;

		$members_table  = $wpdb->prefix . 'hamnaghsheh_project_members';
		$projects_table = $wpdb->prefix . 'hamnaghsheh_projects';

		$tables = $wpdb->get_col( 'SHOW TABLES' ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared

		$members = array();

		// Add owner.
		if ( in_array( $projects_table, $tables, true ) ) {
			$owner_id = $wpdb->get_var(
				$wpdb->prepare(
					// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
					"SELECT user_id FROM {$projects_table} WHERE id = %d",
					$project_id
				)
			);
			if ( $owner_id ) {
				$members[] = (object) array( 'user_id' => (int) $owner_id );
			}
		}

		// Add project members.
		if ( in_array( $members_table, $tables, true ) ) {
			$rows = $wpdb->get_results(
				$wpdb->prepare(
					// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
					"SELECT user_id FROM {$members_table} WHERE project_id = %d",
					$project_id
				)
			);
			foreach ( $rows as $row ) {
				$uid = (int) $row->user_id;
				// Avoid duplicates (owner may also be in members).
				$already_added = false;
				foreach ( $members as $existing ) {
					if ( (int) $existing->user_id === $uid ) {
						$already_added = true;
						break;
					}
				}
				if ( ! $already_added ) {
					$members[] = (object) array( 'user_id' => $uid );
				}
			}
		}

		return $members;
	}

	/**
	 * Get the project name/title.
	 *
	 * @param int $project_id
	 * @return string
	 */
	private function get_project_name( $project_id ) {
		global $wpdb;

		$projects_table = $wpdb->prefix . 'hamnaghsheh_projects';
		$tables         = $wpdb->get_col( 'SHOW TABLES' ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared

		if ( ! in_array( $projects_table, $tables, true ) ) {
			return 'پروژه';
		}

		$name = $wpdb->get_var(
			$wpdb->prepare(
				// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				"SELECT title FROM {$projects_table} WHERE id = %d",
				$project_id
			)
		);

		return $name ? $name : 'پروژه';
	}
}

<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class HChat_Activity {

	public static function get_events( $project_id, $after_id = 0, $limit = 20 ) {
		global $wpdb;
		$fl = $wpdb->prefix . 'hamnaghsheh_file_logs';
		$hf = $wpdb->prefix . 'hamnaghsheh_files';
		$hu = $wpdb->prefix . 'hamnaghsheh_users';

		return $wpdb->get_results( $wpdb->prepare(
			// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
			"SELECT fl.id, fl.action_type, fl.created_at,
					COALESCE(hf.file_name, '') AS file_name,
					COALESCE(hu.display_name, hu.username, 'کاربر') AS display_name
			 FROM {$fl} fl
			 LEFT JOIN {$hf} hf ON hf.id = fl.file_id
			 LEFT JOIN {$hu} hu ON hu.user_id = fl.user_id
			 WHERE fl.project_id = %d AND fl.id > %d
			 ORDER BY fl.id DESC
			 LIMIT %d",
			$project_id, $after_id, $limit
		) );
	}

	public static function get_events_before( $project_id, $before_id, $limit = 20 ) {
		global $wpdb;
		$fl = $wpdb->prefix . 'hamnaghsheh_file_logs';
		$hf = $wpdb->prefix . 'hamnaghsheh_files';
		$hu = $wpdb->prefix . 'hamnaghsheh_users';

		$rows = $wpdb->get_results( $wpdb->prepare(
			// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
			"SELECT fl.id, fl.action_type, fl.created_at,
					COALESCE(hf.file_name, '') AS file_name,
					COALESCE(hu.display_name, hu.username, 'کاربر') AS display_name
			 FROM {$fl} fl
			 LEFT JOIN {$hf} hf ON hf.id = fl.file_id
			 LEFT JOIN {$hu} hu ON hu.user_id = fl.user_id
			 WHERE fl.project_id = %d AND fl.id < %d
			 ORDER BY fl.id DESC
			 LIMIT %d",
			$project_id, $before_id, $limit
		) );
		return array_reverse( $rows );
	}

	public static function get_unseen_count( $project_id, $user_id ) {
		global $wpdb;
		$fl = $wpdb->prefix . 'hamnaghsheh_file_logs';
		$as = $wpdb->prefix . 'hamnaghsheh_chat_activity_seen';

		$last_seen = (int) $wpdb->get_var( $wpdb->prepare(
			// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
			"SELECT last_seen_log_id FROM {$as} WHERE project_id = %d AND user_id = %d",
			$project_id, $user_id
		) );

		return (int) $wpdb->get_var( $wpdb->prepare(
			// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
			"SELECT COUNT(*) FROM {$fl} WHERE project_id = %d AND id > %d",
			$project_id, $last_seen
		) );
	}

	public static function mark_seen( $project_id, $user_id, $last_log_id ) {
		global $wpdb;
		$table = $wpdb->prefix . 'hamnaghsheh_chat_activity_seen';
		$wpdb->query( $wpdb->prepare(
			// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
			"INSERT INTO {$table} (project_id, user_id, last_seen_log_id)
			 VALUES (%d, %d, %d)
			 ON DUPLICATE KEY UPDATE last_seen_log_id = GREATEST(last_seen_log_id, %d), updated_at = NOW()",
			$project_id, $user_id, $last_log_id, $last_log_id
		) );
	}
}

<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class HChat_Activity {

	/**
	 * Get activity events after a given ID (newest first, LIMIT 20).
	 *
	 * @param int $project_id
	 * @param int $after_id   Return events with id > after_id (0 = latest 20).
	 * @param int $limit
	 * @return array
	 */
	public static function get_events( $project_id, $after_id = 0, $limit = 20 ) {
		global $wpdb;

		$fl = $wpdb->prefix . 'hamnaghsheh_file_logs';
		$hu = $wpdb->prefix . 'hamnaghsheh_users';
		$hf = $wpdb->prefix . 'hamnaghsheh_files';

		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		return $wpdb->get_results(
			$wpdb->prepare(
				// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				"SELECT fl.id, COALESCE(hf.file_name,'') AS file_name, fl.action_type,
				        COALESCE(hu.display_name,'') AS display_name, fl.created_at
				 FROM {$fl} fl
				 LEFT JOIN {$hf} hf ON hf.id = fl.file_id
				 LEFT JOIN {$hu} hu ON hu.user_id = fl.user_id
				 WHERE fl.project_id = %d AND fl.id > %d
				 ORDER BY fl.id DESC
				 LIMIT %d",
				$project_id,
				$after_id,
				$limit
			)
		);
	}

	/**
	 * Get activity events before a given ID (newest first, LIMIT 20).
	 *
	 * @param int $project_id
	 * @param int $before_id
	 * @param int $limit
	 * @return array
	 */
	public static function get_events_before( $project_id, $before_id, $limit = 20 ) {
		global $wpdb;

		$fl = $wpdb->prefix . 'hamnaghsheh_file_logs';
		$hu = $wpdb->prefix . 'hamnaghsheh_users';
		$hf = $wpdb->prefix . 'hamnaghsheh_files';

		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		return $wpdb->get_results(
			$wpdb->prepare(
				// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				"SELECT fl.id, COALESCE(hf.file_name,'') AS file_name, fl.action_type,
				        COALESCE(hu.display_name,'') AS display_name, fl.created_at
				 FROM {$fl} fl
				 LEFT JOIN {$hf} hf ON hf.id = fl.file_id
				 LEFT JOIN {$hu} hu ON hu.user_id = fl.user_id
				 WHERE fl.project_id = %d AND fl.id < %d
				 ORDER BY fl.id DESC
				 LIMIT %d",
				$project_id,
				$before_id,
				$limit
			)
		);
	}

	/**
	 * Count unseen activity events for a user in a project.
	 *
	 * @param int $project_id
	 * @param int $user_id
	 * @return int
	 */
	public static function get_unseen_count( $project_id, $user_id ) {
		global $wpdb;

		$fl   = $wpdb->prefix . 'hamnaghsheh_file_logs';
		$seen = $wpdb->prefix . 'hamnaghsheh_chat_activity_seen';

		$last_seen = (int) $wpdb->get_var(
			$wpdb->prepare(
				// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				"SELECT last_seen_log_id FROM {$seen} WHERE project_id = %d AND user_id = %d",
				$project_id,
				$user_id
			)
		);

		return (int) $wpdb->get_var(
			$wpdb->prepare(
				// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				"SELECT COUNT(*) FROM {$fl} WHERE project_id = %d AND id > %d",
				$project_id,
				$last_seen
			)
		);
	}

	/**
	 * Mark activity as seen up to $last_log_id.
	 *
	 * @param int $project_id
	 * @param int $user_id
	 * @param int $last_log_id
	 */
	public static function mark_seen( $project_id, $user_id, $last_log_id ) {
		global $wpdb;

		$seen = $wpdb->prefix . 'hamnaghsheh_chat_activity_seen';

		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$wpdb->query(
			$wpdb->prepare(
				// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				"INSERT INTO {$seen} (project_id, user_id, last_seen_log_id)
				 VALUES (%d, %d, %d)
				 ON DUPLICATE KEY UPDATE last_seen_log_id = GREATEST(last_seen_log_id, %d)",
				$project_id,
				$user_id,
				$last_log_id,
				$last_log_id
			)
		);
	}
}

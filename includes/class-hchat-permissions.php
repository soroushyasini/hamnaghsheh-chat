<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class HChat_Permissions {

	/**
	 * Check whether a given user has access to a project's chat.
	 *
	 * @param int $project_id
	 * @param int $user_id
	 * @return bool
	 */
	public static function can_access( $project_id, $user_id ) {
		if ( ! $user_id ) {
			return false;
		}

		// WordPress administrators always have access.
		$user = get_userdata( $user_id );
		if ( $user && user_can( $user, 'manage_options' ) ) {
			return true;
		}

		// Fetch the project to check ownership and membership.
		global $wpdb;
		$project_table = $wpdb->prefix . 'hamnaghsheh_projects';

		// Bail gracefully if the main plugin table does not exist.
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$tables = $wpdb->get_col( 'SHOW TABLES' );
		if ( ! in_array( $project_table, $tables, true ) ) {
			return false;
		}

		$project = $wpdb->get_row(
			$wpdb->prepare(
				// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				"SELECT id, user_id FROM {$project_table} WHERE id = %d",
				$project_id
			)
		);

		if ( ! $project ) {
			return false;
		}

		// Project owner.
		if ( (int) $project->user_id === (int) $user_id ) {
			return true;
		}

		// Project members.
		$members_table = $wpdb->prefix . 'hamnaghsheh_project_members';
		if ( ! in_array( $members_table, $tables, true ) ) {
			return false;
		}

		$is_member = $wpdb->get_var(
			$wpdb->prepare(
				// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				"SELECT COUNT(*) FROM {$members_table} WHERE project_id = %d AND user_id = %d",
				$project_id,
				$user_id
			)
		);

		return (int) $is_member > 0;
	}
}

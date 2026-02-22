<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class HChat_Messages {

	/** @var string */
	private $table;

	public function __construct() {
		global $wpdb;
		$this->table = $wpdb->prefix . 'hamnaghsheh_chat_messages';
	}

	/**
	 * Save a new message and return the inserted row.
	 *
	 * @param int    $project_id
	 * @param int    $sender_id
	 * @param string $sender_name
	 * @param string $message
	 * @return object|null
	 */
	public function save( $project_id, $sender_id, $sender_name, $message ) {
		global $wpdb;

		$wpdb->insert(
			$this->table,
			array(
				'project_id'  => (int) $project_id,
				'sender_id'   => (int) $sender_id,
				'sender_name' => sanitize_text_field( $sender_name ),
				'message'     => wp_kses_post( $message ),
				'read_by'     => wp_json_encode( array( (int) $sender_id ) ),
			),
			array( '%d', '%d', '%s', '%s', '%s' )
		);

		$insert_id = $wpdb->insert_id;
		if ( ! $insert_id ) {
			return null;
		}

		return $this->get_by_id( $insert_id );
	}

	/**
	 * Fetch a single message by ID.
	 *
	 * @param int $id
	 * @return object|null
	 */
	public function get_by_id( $id ) {
		global $wpdb;

		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		return $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$this->table} WHERE id = %d", $id ) );
	}

	/**
	 * Get messages newer than $after_id for a project.
	 *
	 * @param int $project_id
	 * @param int $after_id
	 * @return array
	 */
	public function get_after( $project_id, $after_id ) {
		global $wpdb;

		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		return $wpdb->get_results(
			$wpdb->prepare(
				"SELECT * FROM {$this->table} WHERE project_id = %d AND id > %d ORDER BY id ASC LIMIT 50",
				$project_id,
				$after_id
			)
		);
	}

	/**
	 * Get messages older than $before_id for a project (for "load earlier").
	 *
	 * @param int $project_id
	 * @param int $before_id
	 * @return array  Ordered oldest-first for display.
	 */
	public function get_before( $project_id, $before_id ) {
		global $wpdb;

		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT * FROM {$this->table} WHERE project_id = %d AND id < %d ORDER BY id DESC LIMIT 20",
				$project_id,
				$before_id
			)
		);

		return array_reverse( $rows );
	}

	/**
	 * Mark all unread messages in a project as read by $user_id.
	 *
	 * @param int $project_id
	 * @param int $user_id
	 */
	public function mark_read( $project_id, $user_id ) {
		global $wpdb;

		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT id, read_by FROM {$this->table} WHERE project_id = %d AND sender_id != %d",
				$project_id,
				$user_id
			)
		);

		foreach ( $rows as $row ) {
			$read_by = json_decode( $row->read_by, true );
			if ( ! is_array( $read_by ) ) {
				$read_by = array();
			}
			if ( in_array( (int) $user_id, $read_by, true ) ) {
				continue;
			}
			$read_by[] = (int) $user_id;
			$wpdb->update(
				$this->table,
				array( 'read_by' => wp_json_encode( $read_by ) ),
				array( 'id' => (int) $row->id ),
				array( '%s' ),
				array( '%d' )
			);
		}
	}

	/**
	 * Count unread messages for $user_id in a project.
	 *
	 * @param int $project_id
	 * @param int $user_id
	 * @return int
	 */
	public function unread_count( $project_id, $user_id ) {
		global $wpdb;

		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT read_by FROM {$this->table} WHERE project_id = %d AND sender_id != %d",
				$project_id,
				$user_id
			)
		);

		$count = 0;
		foreach ( $rows as $row ) {
			$read_by = json_decode( $row->read_by, true );
			if ( ! is_array( $read_by ) || ! in_array( (int) $user_id, $read_by, true ) ) {
				++$count;
			}
		}
		return $count;
	}
}

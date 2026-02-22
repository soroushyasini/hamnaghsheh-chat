<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class HChat_Activator {

	public static function activate() {
		global $wpdb;

		$table_name      = $wpdb->prefix . 'hamnaghsheh_chat_messages';
		$charset_collate = $wpdb->get_charset_collate();

		$sql = "CREATE TABLE {$table_name} (
  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  project_id bigint(20) unsigned NOT NULL,
  sender_id bigint(20) unsigned NOT NULL,
  sender_name varchar(255) NOT NULL,
  message text NOT NULL,
  read_by longtext DEFAULT NULL,
  created_at datetime DEFAULT current_timestamp(),
  PRIMARY KEY (id),
  KEY project_id (project_id),
  KEY sender_id (sender_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_520_ci;";

		$activity_seen_table = $wpdb->prefix . 'hamnaghsheh_chat_activity_seen';

		$sql2 = "CREATE TABLE {$activity_seen_table} (
  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  project_id bigint(20) unsigned NOT NULL,
  user_id bigint(20) unsigned NOT NULL,
  last_seen_log_id bigint(20) unsigned NOT NULL DEFAULT 0,
  updated_at datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (id),
  UNIQUE KEY project_user (project_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_520_ci;";

		require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		dbDelta( $sql );
		dbDelta( $sql2 );
	}
}

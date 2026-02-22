<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class HChat_Notify {

	/**
	 * Send email notifications to all project members (except the sender)
	 * with a 5-minute cooldown per member per project.
	 *
	 * @param int    $project_id
	 * @param int    $sender_id
	 * @param array  $members  Array of objects with user_id property.
	 * @param string $project_name
	 */
	public static function notify_members( $project_id, $sender_id, $members, $project_name ) {
		$project_url = self::get_project_url();

		foreach ( $members as $member ) {
			$recipient_id = (int) $member->user_id;
			if ( $recipient_id === (int) $sender_id ) {
				continue;
			}

			$meta_key       = 'hchat_last_notified_' . $project_id;
			$last_notified  = (int) get_user_meta( $recipient_id, $meta_key, true );
			$five_minutes   = 5 * 60;

			if ( $last_notified && ( time() - $last_notified ) < $five_minutes ) {
				continue;
			}

			$user = get_userdata( $recipient_id );
			if ( ! $user || ! $user->user_email ) {
				continue;
			}

			$subject = sprintf( 'پیام جدید در پروژه %s', $project_name );
			$body    = sprintf(
				"شما یک پیام جدید در پروژه «%s» دارید.\n\nبرای مشاهده به این آدرس مراجعه کنید:\n%s",
				$project_name,
				$project_url
			);

			wp_mail( $user->user_email, $subject, $body );
			update_user_meta( $recipient_id, $meta_key, time() );
		}
	}

	/**
	 * Resolve the URL of the page containing the [hamnaghsheh_project_show] shortcode.
	 *
	 * @return string
	 */
	private static function get_project_url() {
		global $wpdb;

		$like = '%' . $wpdb->esc_like( 'hamnaghsheh_project_show' ) . '%';

		$page_id = $wpdb->get_var(
			$wpdb->prepare(
				"SELECT ID FROM {$wpdb->posts}
				 WHERE post_status = 'publish'
				   AND post_type   = 'page'
				   AND post_content LIKE %s
				 LIMIT 1",
				$like
			)
		);

		if ( $page_id ) {
			return get_permalink( (int) $page_id );
		}

		return home_url();
	}
}

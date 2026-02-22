<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
/**
 * @var object $project  Project object with at least id and user_id.
 * @var array  $files    Array of project file objects.
 * @var array  $members  Array of member objects each with user_id property.
 */
?>
<div id="hchat-widget" class="hchat-widget" dir="rtl" data-project-id="<?php echo esc_attr( $project->id ); ?>">

	<!-- Toggle button -->
	<button id="hchat-toggle-btn" class="hchat-toggle-btn" aria-label="<?php esc_attr_e( 'باز کردن چت', 'hamnaghsheh-chat' ); ?>">
		<svg class="hchat-icon-chat" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="26" height="26">
			<path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z"/>
		</svg>
		<span id="hchat-badge" class="hchat-badge" style="display:none;">0</span>
	</button>

	<!-- Chat panel -->
	<div id="hchat-panel" class="hchat-panel" style="display:none;">

		<!-- Header -->
		<div class="hchat-header">
			<span class="hchat-header-title"><?php esc_html_e( 'چت پروژه', 'hamnaghsheh-chat' ); ?></span>
			<button id="hchat-close-btn" class="hchat-close-btn" aria-label="<?php esc_attr_e( 'بستن', 'hamnaghsheh-chat' ); ?>">
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
					<path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
				</svg>
			</button>
		</div>

		<!-- Tab bar -->
		<div class="hchat-tabs">
			<button class="hchat-tab hchat-tab--active" data-tab="chat">
				💬 <?php esc_html_e( 'چت', 'hamnaghsheh-chat' ); ?>
				<span class="hchat-tab-badge" id="hchat-chat-badge-tab"></span>
			</button>
			<button class="hchat-tab" data-tab="activity">
				📋 <?php esc_html_e( 'رویدادها', 'hamnaghsheh-chat' ); ?>
				<span class="hchat-tab-badge" id="hchat-activity-badge-tab"></span>
			</button>
		</div>

		<!-- Chat pane -->
		<div id="hchat-chat-pane" class="hchat-chat-pane">

			<!-- Messages area -->
			<div id="hchat-messages" class="hchat-messages">

				<!-- Load earlier button -->
				<button id="hchat-load-earlier-btn" class="hchat-load-earlier-btn" style="display:none;">
					<?php esc_html_e( 'پیام‌های قدیمی‌تر', 'hamnaghsheh-chat' ); ?>
				</button>

				<!-- Message list -->
				<div id="hchat-message-list" class="hchat-message-list">
					<!-- Messages rendered by JS -->
				</div>

				<!-- Empty state -->
				<div id="hchat-empty-state" class="hchat-empty-state" style="display:none;">
					<span class="hchat-empty-icon">💬</span>
					<p><?php esc_html_e( 'هنوز پیامی ارسال نشده. اولین نفر باشید!', 'hamnaghsheh-chat' ); ?></p>
				</div>

			</div><!-- /.hchat-messages -->

			<!-- Input area -->
			<div class="hchat-input-area" style="position:relative;">
				<!-- File autocomplete dropdown -->
				<div id="hchat-file-dropdown" class="hchat-file-dropdown"></div>
				<textarea
					id="hchat-input"
					class="hchat-input"
					placeholder="<?php esc_attr_e( 'پیام خود را بنویسید...', 'hamnaghsheh-chat' ); ?>"
					rows="1"
					maxlength="1000"
					dir="rtl"
				></textarea>
				<button id="hchat-send-btn" class="hchat-send-btn" aria-label="<?php esc_attr_e( 'ارسال', 'hamnaghsheh-chat' ); ?>">
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
						<path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
					</svg>
				</button>
			</div>

		</div><!-- /.hchat-chat-pane -->

		<!-- Activity pane -->
		<div id="hchat-activity-pane" class="hchat-activity-pane" style="display:none;">
			<button id="hchat-load-earlier-activity-btn" class="hchat-load-earlier-btn" style="display:none;">
				<?php esc_html_e( 'رویدادهای قدیمی‌تر', 'hamnaghsheh-chat' ); ?>
			</button>
			<div id="hchat-activity-list" class="hchat-activity-list">
				<!-- Activity cards rendered by JS -->
			</div>
			<div id="hchat-activity-empty" class="hchat-empty-state" style="display:none;">
				<span>📋</span>
				<p><?php esc_html_e( 'هنوز رویدادی ثبت نشده.', 'hamnaghsheh-chat' ); ?></p>
			</div>
		</div><!-- /.hchat-activity-pane -->

	</div><!-- /.hchat-panel -->

</div><!-- /#hchat-widget -->

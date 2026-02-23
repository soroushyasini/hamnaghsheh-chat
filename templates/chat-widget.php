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
		<svg class="hchat-icon-chat" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" width="26" height="26">
			<!-- Modern chat bubble with three dots inside -->
			<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" fill="white" opacity="0.95"/>
			<circle cx="9" cy="11" r="1" fill="#09375B"/>
			<circle cx="12" cy="11" r="1" fill="#09375B"/>
			<circle cx="15" cy="11" r="1" fill="#09375B"/>
		</svg>
		<span id="hchat-badge" class="hchat-badge" style="display:none;">0</span>
	</button>

	<!-- Chat panel -->
	<div id="hchat-panel" class="hchat-panel" style="display:none;">

		<!-- Header -->
		<div class="hchat-header">
			<span class="hchat-header-title"><?php esc_html_e( 'چت پروژه', 'hamnaghsheh-chat' ); ?></span>
			<button id="hchat-close-btn" class="hchat-close-btn" aria-label="<?php esc_attr_e( 'بستن', 'hamnaghsheh-chat' ); ?>">
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" width="16" height="16">
					<line x1="18" y1="6" x2="6" y2="18"></line>
					<line x1="6" y1="6" x2="18" y2="18"></line>
				</svg>
			</button>
		</div>

		<!-- Tabs -->
		<div class="hchat-tabs">
			<button class="hchat-tab hchat-tab--active" data-tab="chat">
				<?php esc_html_e( '💬 چت', 'hamnaghsheh-chat' ); ?>
				<span class="hchat-tab-badge" id="hchat-chat-badge-tab" style="display:none;"></span>
			</button>
			<button class="hchat-tab" data-tab="activity">
				<?php esc_html_e( '📋 رویدادها', 'hamnaghsheh-chat' ); ?>
				<span class="hchat-tab-badge" id="hchat-activity-badge-tab" style="display:none;"></span>
			</button>
		</div>

		<!-- Chat pane -->
		<div id="hchat-chat-pane" class="hchat-pane">

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
			<div class="hchat-input-area">
				<!-- File autocomplete dropdown -->
				<div id="hchat-file-dropdown" class="hchat-file-dropdown" style="display:none;"></div>
				<textarea
					id="hchat-input"
					class="hchat-input"
					placeholder="<?php esc_attr_e( 'پیام خود را بنویسید...', 'hamnaghsheh-chat' ); ?>"
					rows="1"
					maxlength="1000"
					dir="rtl"
				></textarea>
				<button id="hchat-send-btn" class="hchat-send-btn" aria-label="<?php esc_attr_e( 'ارسال', 'hamnaghsheh-chat' ); ?>">
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18">
						<line x1="22" y1="2" x2="11" y2="13"></line>
						<polygon points="22 2 15 22 11 13 2 9 22 2" fill="#ffffff" stroke="#ffffff"></polygon>
					</svg>
				</button>
			</div>

		</div><!-- /#hchat-chat-pane -->

		<!-- Activity pane -->
		<div id="hchat-activity-pane" class="hchat-pane hchat-activity-pane" style="display:none;">
			<button id="hchat-load-earlier-activity-btn" class="hchat-load-earlier-btn" style="display:none;">
				<?php esc_html_e( 'رویدادهای قدیمی‌تر', 'hamnaghsheh-chat' ); ?>
			</button>
			<div id="hchat-activity-list" class="hchat-activity-list"></div>
			<div id="hchat-activity-empty" class="hchat-empty-state" style="display:none;">
				<span>📋</span>
				<p><?php esc_html_e( 'هنوز رویدادی ثبت نشده.', 'hamnaghsheh-chat' ); ?></p>
			</div>
		</div><!-- /#hchat-activity-pane -->

	</div><!-- /.hchat-panel -->

</div><!-- /#hchat-widget -->

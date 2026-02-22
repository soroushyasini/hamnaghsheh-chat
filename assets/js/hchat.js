/* global hchatConfig */
document.addEventListener( 'DOMContentLoaded', function () {
(function () {
	'use strict';

	/* ---------------------------------------------------------------
	   Configuration — injected by wp_localize_script
	--------------------------------------------------------------- */
	var cfg = window.hchatConfig || {};
	var ajaxUrl       = cfg.ajax_url      || '';
	var nonce         = cfg.nonce         || '';
	var currentUserId = parseInt( cfg.current_user_id, 10 ) || 0;

	// Read project_id from the widget DOM data attribute (reliable source).
	// Fall back to hchatConfig.project_id only if widget not yet in DOM.
	var widgetEl  = document.getElementById( 'hchat-widget' );
	var projectId = widgetEl
		? parseInt( widgetEl.getAttribute( 'data-project-id' ), 10 ) || 0
		: parseInt( cfg.project_id, 10 ) || 0;

	if ( ! projectId || ! currentUserId ) {
		/* eslint-disable no-console */
		console.warn( 'hchat: Missing projectId or currentUserId — widget disabled.' );
		/* eslint-enable no-console */
		return;
	}

	/* ---------------------------------------------------------------
	   DOM references
	--------------------------------------------------------------- */
	var widget                  = document.getElementById( 'hchat-widget' );
	var toggleBtn               = document.getElementById( 'hchat-toggle-btn' );
	var closeBtn                = document.getElementById( 'hchat-close-btn' );
	var panel                   = document.getElementById( 'hchat-panel' );
	var chatPane                = document.getElementById( 'hchat-chat-pane' );
	var activityPane            = document.getElementById( 'hchat-activity-pane' );
	var messagesArea            = document.getElementById( 'hchat-messages' );
	var messageList             = document.getElementById( 'hchat-message-list' );
	var loadEarlierBtn          = document.getElementById( 'hchat-load-earlier-btn' );
	var emptyState              = document.getElementById( 'hchat-empty-state' );
	var inputEl                 = document.getElementById( 'hchat-input' );
	var sendBtn                 = document.getElementById( 'hchat-send-btn' );
	var badge                   = document.getElementById( 'hchat-badge' );
	var tabButtons              = document.querySelectorAll( '.hchat-tab' );
	var chatBadgeTab            = document.getElementById( 'hchat-chat-badge-tab' );
	var activityBadgeTab        = document.getElementById( 'hchat-activity-badge-tab' );
	var activityList            = document.getElementById( 'hchat-activity-list' );
	var activityEmpty           = document.getElementById( 'hchat-activity-empty' );
	var loadEarlierActivityBtn  = document.getElementById( 'hchat-load-earlier-activity-btn' );
	var fileDropdown            = document.getElementById( 'hchat-file-dropdown' );

	if ( ! widget ) { return; }

	/* ---------------------------------------------------------------
	   State
	--------------------------------------------------------------- */
	var isOpen             = false;
	var lastMessageId      = 0;
	var firstMessageId     = 0;
	var isSending          = false;
	var pollTimer          = null;
	var badgeTimer         = null;
	var activeTab          = 'chat';
	var activityLoaded     = false;
	var lastActivityId     = 0;
	var firstActivityId    = 0;
	var activityPollTimer  = null;
	var activityBadgeTimer = null;
	var fileCache          = null;
	var dropdownActiveIdx  = -1;
	var atQuery            = null; // current @query string or null

	/* ---------------------------------------------------------------
	   Utility helpers
	--------------------------------------------------------------- */
	function formatTime( dateStr ) {
		try {
			var d = new Date( dateStr.replace( / /g, 'T' ) );
			return new Intl.DateTimeFormat( 'fa-IR-u-ca-persian', {
				hour:   '2-digit',
				minute: '2-digit'
			} ).format( d );
		} catch ( e ) {
			return dateStr;
		}
	}

	function formatActivityTime( dateStr ) {
		try {
			var d = new Date( dateStr.replace( / /g, 'T' ) );
			var now = new Date();
			var today = new Date( now.getFullYear(), now.getMonth(), now.getDate() );
			var yesterday = new Date( today - 86400000 );
			var dDay = new Date( d.getFullYear(), d.getMonth(), d.getDate() );
			var timeStr = new Intl.DateTimeFormat( 'fa-IR-u-ca-persian', { hour: '2-digit', minute: '2-digit' } ).format( d );
			if ( dDay.getTime() === today.getTime() ) {
				return timeStr;
			} else if ( dDay.getTime() === yesterday.getTime() ) {
				return 'دیروز • ' + timeStr;
			} else {
				var dateStr2 = new Intl.DateTimeFormat( 'fa-IR-u-ca-persian', { year: 'numeric', month: '2-digit', day: '2-digit' } ).format( d );
				return dateStr2 + ' • ' + timeStr;
			}
		} catch ( e ) {
			return dateStr;
		}
	}

	function isNearBottom() {
		return messagesArea.scrollHeight - messagesArea.scrollTop - messagesArea.clientHeight < 80;
	}

	function scrollToBottom() {
		messagesArea.scrollTop = messagesArea.scrollHeight;
	}

	function escapeHtml( str ) {
		var div = document.createElement( 'div' );
		div.appendChild( document.createTextNode( str ) );
		return div.innerHTML;
	}

	var activityIcons = {
		upload:   '📤',
		replace:  '🔄',
		delete:   '🗑️',
		download: '📥',
		see:      '👁️'
	};

	var activityLabels = {
		upload:   'آپلود شد',
		replace:  'جایگزین شد',
		delete:   'حذف شد',
		download: 'دانلود شد',
		see:      'مشاهده شد'
	};

	/* ---------------------------------------------------------------
	   Parse @[filename|id] tokens into styled HTML
	--------------------------------------------------------------- */
	function parseFileTags( text ) {
		return text.replace( /@\[([^\]|]+)\|(\d+)\]/g, function ( match, name, id ) {
			var isDeleted = ! fileCache || ! fileCache.find( function ( f ) {
				return parseInt( f.id, 10 ) === parseInt( id, 10 );
			} );
			if ( isDeleted && name === 'deleted' ) {
				return '<span class="hchat-file-tag hchat-file-tag--deleted">📎 فایل حذف شده</span>';
			}
			return '<span class="hchat-file-tag" data-file-id="' + escapeHtml( id ) + '">📎 ' + escapeHtml( name ) + '</span>';
		} );
	}

	/* ---------------------------------------------------------------
	   Render a single message bubble
	--------------------------------------------------------------- */
	function renderMessage( msg ) {
		var isMine = parseInt( msg.sender_id, 10 ) === currentUserId;
		var cls    = isMine ? 'hchat-msg--mine' : 'hchat-msg--theirs';
		var time   = formatTime( msg.created_at );

		var div = document.createElement( 'div' );
		div.className = 'hchat-msg ' + cls;
		div.dataset.id = msg.id;

		var escapedMsg = escapeHtml( msg.message );
		var parsedMsg  = parseFileTags( escapedMsg );

		div.innerHTML =
			'<div class="hchat-msg__bubble">' + parsedMsg + '</div>' +
			'<div class="hchat-msg__meta">' +
				'<span class="hchat-msg__sender">' + escapeHtml( msg.sender_name ) + '</span>' +
				'<span class="hchat-msg__time">'   + escapeHtml( time )            + '</span>' +
			'</div>';
		return div;
	}

	/* ---------------------------------------------------------------
	   Render a single activity card
	--------------------------------------------------------------- */
	function renderActivityCard( ev, unseen ) {
		var icon    = activityIcons[ ev.action_type ]  || '📄';
		var label   = activityLabels[ ev.action_type ] || ev.action_type;
		var timeStr = formatActivityTime( ev.created_at );

		var div = document.createElement( 'div' );
		div.className = 'hchat-activity-card' + ( unseen ? ' hchat-activity-card--unseen' : '' );
		div.dataset.id = ev.id;

		div.innerHTML =
			'<div class="hchat-activity-icon">' + icon + '</div>' +
			'<div class="hchat-activity-body">' +
				'<span class="hchat-activity-filename">' + escapeHtml( ev.file_name || 'فایل حذف شده' ) + '</span>' +
				'<span class="hchat-activity-action">'   + escapeHtml( label ) + '</span>' +
				'<div class="hchat-activity-meta">' +
					'<span class="hchat-activity-user">' + escapeHtml( ev.display_name ) + '</span>' +
					'<span class="hchat-activity-dot">•</span>' +
					'<span class="hchat-activity-time">' + escapeHtml( timeStr ) + '</span>' +
				'</div>' +
			'</div>';
		return div;
	}

	/* ---------------------------------------------------------------
	   Append messages to the bottom of the list
	--------------------------------------------------------------- */
	function appendMessages( messages ) {
		if ( ! messages || ! messages.length ) { return; }

		var atBottom = isNearBottom();
		var frag = document.createDocumentFragment();
		messages.forEach( function ( msg ) {
			frag.appendChild( renderMessage( msg ) );
			var id = parseInt( msg.id, 10 );
			if ( id > lastMessageId ) { lastMessageId = id; }
			if ( firstMessageId === 0 || id < firstMessageId ) { firstMessageId = id; }
		} );
		messageList.appendChild( frag );

		updateEmptyState();
		if ( atBottom ) { scrollToBottom(); }
	}

	/* ---------------------------------------------------------------
	   Prepend messages (load earlier)
	--------------------------------------------------------------- */
	function prependMessages( messages ) {
		if ( ! messages || ! messages.length ) { return; }

		var oldScrollHeight = messagesArea.scrollHeight;
		var frag = document.createDocumentFragment();
		messages.forEach( function ( msg ) {
			frag.appendChild( renderMessage( msg ) );
			var id = parseInt( msg.id, 10 );
			if ( firstMessageId === 0 || id < firstMessageId ) { firstMessageId = id; }
		} );
		messageList.insertBefore( frag, messageList.firstChild );

		// Maintain scroll position.
		messagesArea.scrollTop += messagesArea.scrollHeight - oldScrollHeight;
		updateEmptyState();
	}

	/* ---------------------------------------------------------------
	   Show / hide empty state
	--------------------------------------------------------------- */
	function updateEmptyState() {
		var hasMessages = messageList.children.length > 0;
		emptyState.style.display  = hasMessages ? 'none' : 'flex';
	}

	/* ---------------------------------------------------------------
	   Activity rendering helpers
	--------------------------------------------------------------- */
	function appendActivityEvents( events, unseen ) {
		if ( ! events || ! events.length ) { return; }
		var frag = document.createDocumentFragment();
		events.forEach( function ( ev ) {
			frag.appendChild( renderActivityCard( ev, unseen ) );
			var id = parseInt( ev.id, 10 );
			if ( id > lastActivityId )  { lastActivityId  = id; }
			if ( firstActivityId === 0 || id < firstActivityId ) { firstActivityId = id; }
		} );
		activityList.appendChild( frag );
		updateActivityEmpty();
	}

	function prependActivityEvents( events ) {
		if ( ! events || ! events.length ) { return; }
		var frag = document.createDocumentFragment();
		events.forEach( function ( ev ) {
			frag.appendChild( renderActivityCard( ev, false ) );
			var id = parseInt( ev.id, 10 );
			if ( firstActivityId === 0 || id < firstActivityId ) { firstActivityId = id; }
		} );
		activityList.insertBefore( frag, activityList.firstChild );
		updateActivityEmpty();
	}

	function updateActivityEmpty() {
		var hasEvents = activityList.children.length > 0;
		activityEmpty.style.display = hasEvents ? 'none' : 'flex';
	}

	/* ---------------------------------------------------------------
	   AJAX helpers
	--------------------------------------------------------------- */
	function get( action, params, cb ) {
		var url = ajaxUrl + '?action=' + action + '&nonce=' + encodeURIComponent( nonce ) +
			'&project_id=' + projectId;
		for ( var key in params ) {
			if ( Object.prototype.hasOwnProperty.call( params, key ) ) {
				url += '&' + encodeURIComponent( key ) + '=' + encodeURIComponent( params[ key ] );
			}
		}
		var xhr = new XMLHttpRequest();
		xhr.open( 'GET', url, true );
		xhr.onload = function () {
			if ( xhr.status === 200 ) {
				try {
					var res = JSON.parse( xhr.responseText );
					cb( null, res );
				} catch ( e ) {
					cb( e );
				}
			} else {
				cb( new Error( 'HTTP ' + xhr.status ) );
			}
		};
		xhr.onerror = function () { cb( new Error( 'Network error' ) ); };
		xhr.send();
	}

	function post( action, data, cb ) {
		var body = 'action=' + action + '&nonce=' + encodeURIComponent( nonce ) +
			'&project_id=' + projectId;
		for ( var key in data ) {
			if ( Object.prototype.hasOwnProperty.call( data, key ) ) {
				body += '&' + encodeURIComponent( key ) + '=' + encodeURIComponent( data[ key ] );
			}
		}
		var xhr = new XMLHttpRequest();
		xhr.open( 'POST', ajaxUrl, true );
		xhr.setRequestHeader( 'Content-Type', 'application/x-www-form-urlencoded; charset=UTF-8' );
		xhr.onload = function () {
			if ( xhr.status === 200 ) {
				try {
					var res = JSON.parse( xhr.responseText );
					cb( null, res );
				} catch ( e ) {
					cb( e );
				}
			} else {
				cb( new Error( 'HTTP ' + xhr.status ) );
			}
		};
		xhr.onerror = function () { cb( new Error( 'Network error' ) ); };
		xhr.send( body );
	}

	/* ---------------------------------------------------------------
	   Fetch initial messages (last 20 via get_after with after_id=0)
	--------------------------------------------------------------- */
	function loadInitialMessages() {
		get( 'hchat_get_messages', { after_id: 0 }, function ( err, res ) {
			if ( err || ! res.success ) { return; }
			appendMessages( res.data );
			scrollToBottom();
			markRead();
		} );
	}

	/* ---------------------------------------------------------------
	   Poll for new messages every 4 seconds
	--------------------------------------------------------------- */
	function pollNewMessages() {
		get( 'hchat_get_messages', { after_id: lastMessageId }, function ( err, res ) {
			if ( err || ! res.success ) { return; }
			if ( res.data && res.data.length ) {
				appendMessages( res.data );
				markRead();
			}
		} );
	}

	/* ---------------------------------------------------------------
	   Poll unread count every 12 seconds (for badge when closed)
	--------------------------------------------------------------- */
	function pollUnreadCount() {
		get( 'hchat_unread_count', {}, function ( err, res ) {
			if ( err || ! res.success ) { return; }
			var count = parseInt( res.data.count, 10 ) || 0;
			if ( count > 0 ) {
				badge.textContent = count;
				badge.style.display = 'flex';
			} else {
				badge.style.display = 'none';
			}
		} );
	}

	/* ---------------------------------------------------------------
	   Mark all messages as read
	--------------------------------------------------------------- */
	function markRead() {
		post( 'hchat_mark_read', {}, function () {} );
		badge.style.display = 'none';
	}

	/* ---------------------------------------------------------------
	   Load earlier messages
	--------------------------------------------------------------- */
	function loadEarlierMessages() {
		loadEarlierBtn.disabled = true;
		get( 'hchat_load_earlier', { before_id: firstMessageId }, function ( err, res ) {
			loadEarlierBtn.disabled = false;
			if ( err || ! res.success ) { return; }
			var data = res.data;
			prependMessages( data );
			// Hide button if fewer than 20 results returned (no more exist).
			if ( data.length < 20 ) {
				loadEarlierBtn.style.display = 'none';
			}
		} );
	}

	/* ---------------------------------------------------------------
	   Send a message
	--------------------------------------------------------------- */
	function sendMessage() {
		var text = inputEl.value.trim();
		if ( ! text || isSending ) { return; }
		if ( text.length > 1000 ) { text = text.substring( 0, 1000 ); }

		isSending = true;
		sendBtn.disabled = true;

		post( 'hchat_send_message', { message: text }, function ( err, res ) {
			isSending = false;
			sendBtn.disabled = false;
			if ( err || ! res.success ) { return; }
			inputEl.value = '';
			inputEl.style.height = '';
			appendMessages( [ res.data ] );
			scrollToBottom();
			markRead();
		} );
	}

	/* ---------------------------------------------------------------
	   Activity — load initial events
	--------------------------------------------------------------- */
	function loadInitialActivity() {
		get( 'hchat_get_activity', { after_id: 0 }, function ( err, res ) {
			if ( err || ! res.success ) { return; }
			activityLoaded = true;
			appendActivityEvents( res.data, false );
			if ( firstActivityId > 0 ) {
				loadEarlierActivityBtn.style.display = 'block';
			}
			// Mark all seen.
			if ( lastActivityId > 0 ) {
				post( 'hchat_mark_activity_seen', { last_log_id: lastActivityId }, function () {} );
				setActivityTabBadge( 0 );
			}
		} );
	}

	/* ---------------------------------------------------------------
	   Activity — poll for new events (when activity tab is active)
	--------------------------------------------------------------- */
	function pollNewActivity() {
		get( 'hchat_get_activity', { after_id: lastActivityId }, function ( err, res ) {
			if ( err || ! res.success ) { return; }
			if ( res.data && res.data.length ) {
				appendActivityEvents( res.data, false );
				if ( lastActivityId > 0 ) {
					post( 'hchat_mark_activity_seen', { last_log_id: lastActivityId }, function () {} );
				}
				setActivityTabBadge( 0 );
			}
		} );
	}

	/* ---------------------------------------------------------------
	   Activity — poll unseen count badge (every 15s always)
	--------------------------------------------------------------- */
	function pollActivityUnseenCount() {
		get( 'hchat_activity_unseen_count', {}, function ( err, res ) {
			if ( err || ! res.success ) { return; }
			var count = parseInt( res.data.count, 10 ) || 0;
			if ( activeTab !== 'activity' ) {
				setActivityTabBadge( count );
			}
		} );
	}

	/* ---------------------------------------------------------------
	   Activity — load earlier events
	--------------------------------------------------------------- */
	function loadEarlierActivity() {
		loadEarlierActivityBtn.disabled = true;
		get( 'hchat_load_earlier_activity', { before_id: firstActivityId }, function ( err, res ) {
			loadEarlierActivityBtn.disabled = false;
			if ( err || ! res.success ) { return; }
			var data = res.data;
			prependActivityEvents( data );
			if ( data.length < 20 ) {
				loadEarlierActivityBtn.style.display = 'none';
			}
		} );
	}

	/* ---------------------------------------------------------------
	   Tab badge helpers
	--------------------------------------------------------------- */
	function setActivityTabBadge( count ) {
		if ( count > 0 ) {
			activityBadgeTab.textContent = count;
			activityBadgeTab.classList.add( 'hchat-tab-badge--visible' );
		} else {
			activityBadgeTab.textContent = '';
			activityBadgeTab.classList.remove( 'hchat-tab-badge--visible' );
		}
	}

	/* ---------------------------------------------------------------
	   Tab switching
	--------------------------------------------------------------- */
	function switchTab( tab ) {
		activeTab = tab;

		tabButtons.forEach( function ( btn ) {
			if ( btn.getAttribute( 'data-tab' ) === tab ) {
				btn.classList.add( 'hchat-tab--active' );
			} else {
				btn.classList.remove( 'hchat-tab--active' );
			}
		} );

		if ( tab === 'chat' ) {
			chatPane.style.display     = 'flex';
			activityPane.style.display = 'none';

			// Stop activity polling.
			if ( activityPollTimer ) {
				clearInterval( activityPollTimer );
				activityPollTimer = null;
			}
		} else {
			chatPane.style.display     = 'none';
			activityPane.style.display = 'flex';

			// Clear activity badge.
			setActivityTabBadge( 0 );

			// Load activities lazily on first open.
			if ( ! activityLoaded ) {
				loadInitialActivity();
			} else if ( lastActivityId > 0 ) {
				// Mark seen immediately on tab switch.
				post( 'hchat_mark_activity_seen', { last_log_id: lastActivityId }, function () {} );
			}

			// Start activity polling.
			if ( ! activityPollTimer ) {
				activityPollTimer = setInterval( pollNewActivity, 15000 );
			}
		}
	}

	/* ---------------------------------------------------------------
	   Open / close panel
	--------------------------------------------------------------- */
	function openPanel() {
		isOpen = true;
		panel.style.display = 'flex';
		switchTab( 'chat' );
		scrollToBottom();
		markRead();

		// Start message polling.
		if ( ! pollTimer ) {
			pollTimer = setInterval( pollNewMessages, 4000 );
		}
	}

	function closePanel() {
		isOpen = false;
		panel.style.display = 'none';
		activeTab = 'chat';

		// Stop polling timers.
		if ( pollTimer ) {
			clearInterval( pollTimer );
			pollTimer = null;
		}
		if ( activityPollTimer ) {
			clearInterval( activityPollTimer );
			activityPollTimer = null;
		}

		hideFileDropdown();
	}

	/* ---------------------------------------------------------------
	   File autocomplete — fetch project files (cached)
	--------------------------------------------------------------- */
	function fetchProjectFiles( cb ) {
		if ( fileCache !== null ) { cb( fileCache ); return; }
		get( 'hchat_get_project_files', {}, function ( err, res ) {
			if ( ! err && res.success ) {
				fileCache = res.data;
				cb( fileCache );
			} else {
				cb( [] );
			}
		} );
	}

	/* ---------------------------------------------------------------
	   File dropdown helpers
	--------------------------------------------------------------- */
	var dropdownFiles = [];

	function showFileDropdown( files ) {
		fileDropdown.innerHTML = '';
		dropdownActiveIdx = -1;
		dropdownFiles = files;

		if ( ! files || ! files.length ) {
			fileDropdown.classList.remove( 'hchat-file-dropdown--visible' );
			return;
		}

		files.forEach( function ( f, idx ) {
			var item = document.createElement( 'div' );
			item.className = 'hchat-file-dropdown-item';
			item.dataset.idx = idx;
			item.textContent = '📎 ' + f.file_name;
			item.addEventListener( 'mousedown', function ( e ) {
				e.preventDefault();
				selectFileFromDropdown( f );
			} );
			fileDropdown.appendChild( item );
		} );

		fileDropdown.classList.add( 'hchat-file-dropdown--visible' );
	}

	function hideFileDropdown() {
		fileDropdown.classList.remove( 'hchat-file-dropdown--visible' );
		fileDropdown.innerHTML = '';
		dropdownActiveIdx = -1;
		dropdownFiles = [];
		atQuery = null;
	}

	function setDropdownActive( idx ) {
		var items = fileDropdown.querySelectorAll( '.hchat-file-dropdown-item' );
		items.forEach( function ( item, i ) {
			if ( i === idx ) {
				item.classList.add( 'hchat-file-dropdown-item--active' );
				item.scrollIntoView( { block: 'nearest' } );
			} else {
				item.classList.remove( 'hchat-file-dropdown-item--active' );
			}
		} );
		dropdownActiveIdx = idx;
	}

	function selectFileFromDropdown( f ) {
		// Replace the @query in the textarea with the token.
		var val = inputEl.value;
		var atIdx = val.lastIndexOf( '@' );
		if ( atIdx === -1 ) { hideFileDropdown(); return; }
		var token = '@[' + f.file_name + '|' + f.id + ']';
		inputEl.value = val.substring( 0, atIdx ) + token + ' ';
		hideFileDropdown();
		inputEl.focus();
	}

	/* ---------------------------------------------------------------
	   Handle textarea input for @ autocomplete
	--------------------------------------------------------------- */
	inputEl.addEventListener( 'input', function () {
		// Auto-resize.
		this.style.height = 'auto';
		this.style.height = Math.min( this.scrollHeight, 90 ) + 'px';

		var val = this.value;
		var caretPos = this.selectionStart;
		var textBefore = val.substring( 0, caretPos );
		var atIdx = textBefore.lastIndexOf( '@' );

		if ( atIdx === -1 ) {
			hideFileDropdown();
			return;
		}

		// Check no space between @ and caret.
		var query = textBefore.substring( atIdx + 1 );
		if ( query.indexOf( ' ' ) !== -1 ) {
			hideFileDropdown();
			return;
		}

		atQuery = query;
		fetchProjectFiles( function ( files ) {
			var filtered = files.filter( function ( f ) {
				return f.file_name.toLowerCase().indexOf( query.toLowerCase() ) !== -1;
			} );
			showFileDropdown( filtered.slice( 0, 20 ) );
		} );
	} );

	inputEl.addEventListener( 'keydown', function ( e ) {
		var isDropdownOpen = fileDropdown.classList.contains( 'hchat-file-dropdown--visible' );

		if ( isDropdownOpen ) {
			var items = fileDropdown.querySelectorAll( '.hchat-file-dropdown-item' );
			if ( e.key === 'ArrowDown' ) {
				e.preventDefault();
				var next = ( dropdownActiveIdx + 1 ) % items.length;
				setDropdownActive( next );
				return;
			}
			if ( e.key === 'ArrowUp' ) {
				e.preventDefault();
				var prev = dropdownActiveIdx <= 0 ? items.length - 1 : dropdownActiveIdx - 1;
				setDropdownActive( prev );
				return;
			}
			if ( e.key === 'Enter' ) {
				if ( dropdownActiveIdx >= 0 && dropdownFiles[ dropdownActiveIdx ] ) {
					e.preventDefault();
					selectFileFromDropdown( dropdownFiles[ dropdownActiveIdx ] );
					return;
				}
				// No item selected: fall through to send.
				hideFileDropdown();
			}
			if ( e.key === 'Escape' ) {
				e.preventDefault();
				hideFileDropdown();
				return;
			}
		}

		if ( e.key === 'Enter' && ! e.shiftKey && ! isDropdownOpen ) {
			e.preventDefault();
			sendMessage();
		}
	} );

	// Close dropdown on outside click.
	document.addEventListener( 'click', function ( e ) {
		if ( ! fileDropdown.contains( e.target ) && e.target !== inputEl ) {
			hideFileDropdown();
		}
	} );

	/* ---------------------------------------------------------------
	   Event listeners
	--------------------------------------------------------------- */
	toggleBtn.addEventListener( 'click', function () {
		if ( isOpen ) { closePanel(); } else { openPanel(); }
	} );

	closeBtn.addEventListener( 'click', closePanel );

	sendBtn.addEventListener( 'click', sendMessage );

	loadEarlierBtn.addEventListener( 'click', loadEarlierMessages );

	loadEarlierActivityBtn.addEventListener( 'click', loadEarlierActivity );

	tabButtons.forEach( function ( btn ) {
		btn.addEventListener( 'click', function () {
			switchTab( btn.getAttribute( 'data-tab' ) );
		} );
	} );

	/* ---------------------------------------------------------------
	   Initialise on page load
	--------------------------------------------------------------- */
	loadInitialMessages();

	// Show load-earlier button once we have an initial firstMessageId.
	setTimeout( function () {
		if ( firstMessageId > 0 ) {
			loadEarlierBtn.style.display = 'block';
		}
	}, 500 );

	// Always poll unread count (even when panel is closed).
	badgeTimer = setInterval( pollUnreadCount, 12000 );

	// Poll activity unseen count every 15 seconds.
	activityBadgeTimer = setInterval( pollActivityUnseenCount, 15000 );

}());
} );

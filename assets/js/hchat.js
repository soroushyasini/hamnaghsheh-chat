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
	var messagesArea            = document.getElementById( 'hchat-messages' );
	var messageList             = document.getElementById( 'hchat-message-list' );
	var loadEarlierBtn          = document.getElementById( 'hchat-load-earlier-btn' );
	var emptyState              = document.getElementById( 'hchat-empty-state' );
	var inputEl                 = document.getElementById( 'hchat-input' );
	var sendBtn                 = document.getElementById( 'hchat-send-btn' );
	var badge                   = document.getElementById( 'hchat-badge' );
	var fileDropdown            = document.getElementById( 'hchat-file-dropdown' );
	var chatPane                = document.getElementById( 'hchat-chat-pane' );
	var activityPane            = document.getElementById( 'hchat-activity-pane' );
	var activityList            = document.getElementById( 'hchat-activity-list' );
	var activityEmpty           = document.getElementById( 'hchat-activity-empty' );
	var loadEarlierActivityBtn  = document.getElementById( 'hchat-load-earlier-activity-btn' );
	var chatBadgeTab            = document.getElementById( 'hchat-chat-badge-tab' );
	var activityBadgeTab        = document.getElementById( 'hchat-activity-badge-tab' );
	var tabs                    = document.querySelectorAll( '.hchat-tab' );

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
	var activityTimer      = null;
	var activeTab          = 'chat';
	var activityLoaded     = false;
	var firstActivityId    = 0;
	var lastActivityId     = 0;
	var fileCache          = null;  // null = not yet fetched; [] = fetched but empty
	var atQuery            = null;  // current @ search text (null = not in @ mode)
	var dropdownIndex      = -1;

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
			var today     = new Date( now.getFullYear(), now.getMonth(), now.getDate() );
			var yesterday = new Date( today.getTime() - 86400000 );
			var dDay      = new Date( d.getFullYear(), d.getMonth(), d.getDate() );
			var timeStr   = new Intl.DateTimeFormat( 'fa-IR-u-ca-persian', { hour: '2-digit', minute: '2-digit' } ).format( d );
			if ( dDay.getTime() === today.getTime() ) {
				return timeStr;
			} else if ( dDay.getTime() === yesterday.getTime() ) {
				return 'دیروز • ' + timeStr;
			} else {
				var fullDate = new Intl.DateTimeFormat( 'fa-IR-u-ca-persian', { year: 'numeric', month: '2-digit', day: '2-digit' } ).format( d );
				return fullDate + ' • ' + timeStr;
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

	/* ---------------------------------------------------------------
	   File tag parsing — token: @[filename|file_id]
	--------------------------------------------------------------- */
	function parseFileTags( text ) {
		return text.replace( /@\[([^\]|]+)\|(\d+)\]/g, function ( match, fileName, fileId ) {
			var id = parseInt( fileId, 10 );
			// If cache not loaded yet, just render with file name as-is.
			if ( fileCache === null ) {
				return '<span class="hchat-file-tag" data-file-id="' + id + '">📎 ' + escapeHtml( fileName ) + '</span>';
			}
			var exists = fileCache.some( function ( f ) { return parseInt( f.id, 10 ) === id; } );
			if ( exists ) {
				return '<span class="hchat-file-tag" data-file-id="' + id + '">📎 ' + escapeHtml( fileName ) + '</span>';
			} else {
				return '<span class="hchat-file-tag hchat-file-tag--deleted" data-file-id="' + id + '">📎 فایل حذف شده</span>';
			}
		} );
	}

	function renderMessageContent( text ) {
		return parseFileTags( escapeHtml( text ) );
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
		div.innerHTML =
			'<div class="hchat-msg__bubble">' + renderMessageContent( msg.message ) + '</div>' +
			'<div class="hchat-msg__meta">' +
				'<span class="hchat-msg__sender">' + escapeHtml( msg.sender_name ) + '</span>' +
				'<span class="hchat-msg__time">'   + escapeHtml( time )           + '</span>' +
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
	   File autocomplete — @ trigger
	--------------------------------------------------------------- */
	function fetchFileCache( cb ) {
		if ( fileCache !== null ) { cb( fileCache ); return; }
		get( 'hchat_get_project_files', {}, function ( err, res ) {
			if ( err || ! res.success ) { fileCache = []; } else { fileCache = res.data || []; }
			cb( fileCache );
		} );
	}

	function getAtQuery() {
		var val   = inputEl.value;
		var pos   = inputEl.selectionStart;
		var chunk = val.substring( 0, pos );
		var idx   = chunk.lastIndexOf( '@' );
		if ( idx === -1 ) { return null; }
		// Ensure there's no space between @ and cursor.
		var query = chunk.substring( idx + 1 );
		if ( /\s/.test( query ) ) { return null; }
		return query;
	}

	function showDropdown( files ) {
		fileDropdown.innerHTML = '';
		if ( ! files.length ) { fileDropdown.style.display = 'none'; return; }
		files.forEach( function ( f, i ) {
			var item = document.createElement( 'div' );
			item.className = 'hchat-file-dropdown-item';
			item.dataset.id   = f.id;
			item.dataset.name = f.file_name;
			item.dataset.idx  = i;
			item.textContent  = '📎 ' + f.file_name;
			item.addEventListener( 'mousedown', function ( e ) {
				e.preventDefault();
				selectFile( f );
			} );
			fileDropdown.appendChild( item );
		} );
		dropdownIndex = -1;
		fileDropdown.style.display = 'block';
	}

	function hideDropdown() {
		fileDropdown.style.display = 'none';
		fileDropdown.innerHTML = '';
		dropdownIndex = -1;
		atQuery = null;
	}

	function highlightDropdownItem( idx ) {
		var items = fileDropdown.querySelectorAll( '.hchat-file-dropdown-item' );
		items.forEach( function ( it, i ) {
			it.classList.toggle( 'hchat-file-dropdown-item--active', i === idx );
		} );
	}

	function selectFile( f ) {
		var val   = inputEl.value;
		var pos   = inputEl.selectionStart;
		var chunk = val.substring( 0, pos );
		var idx   = chunk.lastIndexOf( '@' );
		if ( idx === -1 ) { hideDropdown(); return; }
		var token  = '@[' + f.file_name + '|' + f.id + ']';
		var before = val.substring( 0, idx );
		var after  = val.substring( pos );
		inputEl.value = before + token + after;
		var newPos = before.length + token.length;
		inputEl.setSelectionRange( newPos, newPos );
		inputEl.focus();
		hideDropdown();
	}

	function onInputChange() {
		var q = getAtQuery();
		if ( q === null ) { hideDropdown(); return; }
		atQuery = q;
		fetchFileCache( function ( files ) {
			if ( ! files.length ) { hideDropdown(); return; }
			var filtered = files.filter( function ( f ) {
				return f.file_name.toLowerCase().indexOf( q.toLowerCase() ) !== -1;
			} );
			showDropdown( filtered );
		} );
	}

	/* ---------------------------------------------------------------
	   Activity feed
	--------------------------------------------------------------- */
	var activityIcons = {
		upload:   '📤',
		replace:  '🔄',
		'delete': '🗑️',
		download: '📥',
		see:      '👁️'
	};

	var activityLabels = {
		upload:   'آپلود شد',
		replace:  'جایگزین شد',
		'delete': 'حذف شد',
		download: 'دانلود شد',
		see:      'مشاهده شد'
	};

	function renderActivityCard( ev ) {
		var icon  = activityIcons[ ev.action_type ]  || '📄';
		var label = activityLabels[ ev.action_type ] || ev.action_type;
		var time  = formatActivityTime( ev.created_at );

		var card = document.createElement( 'div' );
		card.className  = 'hchat-activity-card';
		card.dataset.id = ev.id;
		card.innerHTML =
			'<div class="hchat-activity-icon">' + escapeHtml( icon ) + '</div>' +
			'<div class="hchat-activity-body">' +
				'<div class="hchat-activity-top">' +
					'<span class="hchat-activity-filename">' + escapeHtml( ev.file_name ) + '</span>' +
					'<span class="hchat-activity-action">'   + escapeHtml( label )        + '</span>' +
				'</div>' +
				'<div class="hchat-activity-meta">' +
					'<span class="hchat-activity-user">' + escapeHtml( ev.display_name ) + '</span>' +
					'<span class="hchat-activity-dot">•</span>' +
					'<span class="hchat-activity-time">' + escapeHtml( time ) + '</span>' +
				'</div>' +
			'</div>';
		return card;
	}

	function appendActivityEvents( events ) {
		if ( ! events || ! events.length ) { return; }
		var frag = document.createDocumentFragment();
		events.forEach( function ( ev ) {
			frag.appendChild( renderActivityCard( ev ) );
			var id = parseInt( ev.id, 10 );
			if ( id > lastActivityId ) { lastActivityId = id; }
			if ( firstActivityId === 0 || id < firstActivityId ) { firstActivityId = id; }
		} );
		activityList.appendChild( frag );
		updateActivityEmptyState();
	}

	function prependActivityEvents( events ) {
		if ( ! events || ! events.length ) { return; }
		var frag = document.createDocumentFragment();
		events.forEach( function ( ev ) {
			frag.appendChild( renderActivityCard( ev ) );
			var id = parseInt( ev.id, 10 );
			if ( firstActivityId === 0 || id < firstActivityId ) { firstActivityId = id; }
		} );
		activityList.insertBefore( frag, activityList.firstChild );
		updateActivityEmptyState();
	}

	function updateActivityEmptyState() {
		var hasEvents = activityList.children.length > 0;
		activityEmpty.style.display           = hasEvents ? 'none' : 'flex';
		loadEarlierActivityBtn.style.display  = hasEvents ? 'block' : 'none';
	}

	function loadInitialActivity() {
		get( 'hchat_get_activity', { after_id: 0 }, function ( err, res ) {
			if ( err || ! res.success ) { return; }
			appendActivityEvents( res.data );
			markActivitySeen();
		} );
	}

	function pollNewActivity() {
		get( 'hchat_get_activity', { after_id: lastActivityId }, function ( err, res ) {
			if ( err || ! res.success ) { return; }
			if ( res.data && res.data.length ) {
				appendActivityEvents( res.data );
				if ( activeTab === 'activity' ) { markActivitySeen(); }
			}
		} );
	}

	function pollActivityUnseenCount() {
		get( 'hchat_activity_unseen_count', {}, function ( err, res ) {
			if ( err || ! res.success ) { return; }
			var count = parseInt( res.data.count, 10 ) || 0;
			setActivityBadge( count );
		} );
	}

	function markActivitySeen() {
		if ( ! lastActivityId ) { return; }
		post( 'hchat_mark_activity_seen', { last_log_id: lastActivityId }, function () {} );
		setActivityBadge( 0 );
	}

	function setActivityBadge( count ) {
		if ( count > 0 ) {
			activityBadgeTab.textContent   = count;
			activityBadgeTab.style.display = 'inline-flex';
		} else {
			activityBadgeTab.style.display = 'none';
		}
	}

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
	   Tab switching
	--------------------------------------------------------------- */
	function switchTab( tab ) {
		activeTab = tab;
		tabs.forEach( function ( btn ) {
			var isActive = btn.getAttribute( 'data-tab' ) === tab;
			btn.classList.toggle( 'hchat-tab--active', isActive );
		} );
		if ( tab === 'chat' ) {
			chatPane.style.display     = 'flex';
			activityPane.style.display = 'none';
		} else {
			chatPane.style.display     = 'none';
			activityPane.style.display = 'flex';
			if ( ! activityLoaded ) {
				activityLoaded = true;
				loadInitialActivity();
				// Poll activity for new events.
				if ( ! activityTimer ) {
					activityTimer = setInterval( pollNewActivity, 8000 );
				}
			} else {
				markActivitySeen();
			}
		}
	}

	/* ---------------------------------------------------------------
	   Open / close panel
	--------------------------------------------------------------- */
	function openPanel() {
		isOpen = true;
		panel.style.display = 'flex';
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
		hideDropdown();
		activeTab = 'chat';
		switchTab( 'chat' );

		// Stop message polling when panel is closed; keep badge polling.
		if ( pollTimer ) {
			clearInterval( pollTimer );
			pollTimer = null;
		}
		if ( activityTimer ) {
			clearInterval( activityTimer );
			activityTimer = null;
		}
		activityLoaded = false;
	}

	/* ---------------------------------------------------------------
	   Event listeners
	--------------------------------------------------------------- */
	toggleBtn.addEventListener( 'click', function () {
		if ( isOpen ) { closePanel(); } else { openPanel(); }
	} );

	closeBtn.addEventListener( 'click', closePanel );

	sendBtn.addEventListener( 'click', sendMessage );

	inputEl.addEventListener( 'keydown', function ( e ) {
		// Handle dropdown keyboard navigation.
		if ( fileDropdown.style.display !== 'none' ) {
			var items = fileDropdown.querySelectorAll( '.hchat-file-dropdown-item' );
			if ( e.key === 'ArrowDown' ) {
				e.preventDefault();
				dropdownIndex = Math.min( dropdownIndex + 1, items.length - 1 );
				highlightDropdownItem( dropdownIndex );
				return;
			}
			if ( e.key === 'ArrowUp' ) {
				e.preventDefault();
				dropdownIndex = Math.max( dropdownIndex - 1, 0 );
				highlightDropdownItem( dropdownIndex );
				return;
			}
			if ( e.key === 'Enter' ) {
				if ( dropdownIndex >= 0 && items[ dropdownIndex ] ) {
					e.preventDefault();
					var sel = items[ dropdownIndex ];
					selectFile( { id: sel.dataset.id, file_name: sel.dataset.name } );
					return;
				}
				hideDropdown();
			}
			if ( e.key === 'Escape' ) {
				e.preventDefault();
				hideDropdown();
				return;
			}
		}
		if ( e.key === 'Enter' && ! e.shiftKey ) {
			e.preventDefault();
			sendMessage();
		}
	} );

	inputEl.addEventListener( 'input', function () {
		// Auto-resize.
		this.style.height = 'auto';
		this.style.height = Math.min( this.scrollHeight, 90 ) + 'px';
		// @ autocomplete.
		onInputChange();
	} );

	// Close dropdown on outside click.
	document.addEventListener( 'click', function ( e ) {
		if ( ! fileDropdown.contains( e.target ) && e.target !== inputEl ) {
			hideDropdown();
		}
	} );

	loadEarlierBtn.addEventListener( 'click', loadEarlierMessages );
	loadEarlierActivityBtn.addEventListener( 'click', loadEarlierActivity );

	tabs.forEach( function ( btn ) {
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

	// Poll activity unseen count.
	setInterval( pollActivityUnseenCount, 12000 );

}());
} );

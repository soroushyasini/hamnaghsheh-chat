/* global hchatConfig */
(function () {
	'use strict';

	/* ---------------------------------------------------------------
	   Configuration — injected by wp_localize_script
	--------------------------------------------------------------- */
	var cfg = window.hchatConfig || {};
	var ajaxUrl       = cfg.ajax_url      || '';
	var nonce         = cfg.nonce         || '';
	var projectId     = parseInt( cfg.project_id, 10 ) || 0;
	var currentUserId = parseInt( cfg.current_user_id, 10 ) || 0;

	if ( ! projectId || ! currentUserId ) {
		/* eslint-disable no-console */
		console.warn( 'hchat: Missing projectId or currentUserId — widget disabled.' );
		/* eslint-enable no-console */
		return;
	}

	/* ---------------------------------------------------------------
	   DOM references
	--------------------------------------------------------------- */
	var widget          = document.getElementById( 'hchat-widget' );
	var toggleBtn       = document.getElementById( 'hchat-toggle-btn' );
	var closeBtn        = document.getElementById( 'hchat-close-btn' );
	var panel           = document.getElementById( 'hchat-panel' );
	var messagesArea    = document.getElementById( 'hchat-messages' );
	var messageList     = document.getElementById( 'hchat-message-list' );
	var loadEarlierBtn  = document.getElementById( 'hchat-load-earlier-btn' );
	var emptyState      = document.getElementById( 'hchat-empty-state' );
	var inputEl         = document.getElementById( 'hchat-input' );
	var sendBtn         = document.getElementById( 'hchat-send-btn' );
	var badge           = document.getElementById( 'hchat-badge' );

	if ( ! widget ) { return; }

	/* ---------------------------------------------------------------
	   State
	--------------------------------------------------------------- */
	var isOpen        = false;
	var lastMessageId = 0;
	var firstMessageId = 0;
	var isSending     = false;
	var pollTimer     = null;
	var badgeTimer    = null;

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
			'<div class="hchat-msg__bubble">' + escapeHtml( msg.message ) + '</div>' +
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

		// Stop message polling when panel is closed; keep badge polling.
		if ( pollTimer ) {
			clearInterval( pollTimer );
			pollTimer = null;
		}
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
		if ( e.key === 'Enter' && ! e.shiftKey ) {
			e.preventDefault();
			sendMessage();
		}
	} );

	// Auto-resize textarea.
	inputEl.addEventListener( 'input', function () {
		this.style.height = 'auto';
		this.style.height = Math.min( this.scrollHeight, 90 ) + 'px';
	} );

	loadEarlierBtn.addEventListener( 'click', loadEarlierMessages );

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

}());

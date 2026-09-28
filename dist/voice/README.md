# SPACEVOICE v0.2

Development-only P2P audio between **two tabs in the same browser/storage partition and origin**. Open the same localhost URL in both tabs, select SPACEVOICE and explicitly join `geral`. Allow the microphone. Use a headset or mute one tab to avoid feedback. If autoplay is blocked, click “reproduzir áudio remoto”. HTTPS is required outside localhost.

`media.js` owns capture; `state.js` owns local call state. `signaling-local.js` supplies temporary BroadcastChannel discovery/signaling. `session.js` coordinates one remote peer and elects the smaller ephemeral clientId to offer. `peer.js` owns RTCPeerConnection with empty iceServers and uses abstract send/receive callbacks. A future WebSocket adapter can replace the transport without changing WebRTC.

Mute toggles local audio tracks. Deafen mutes only local remote-audio elements. Leaving, navigating away or pagehide closes signaling, peers and audio playback and stops local tracks. Pending permissions are invalidated; late streams are immediately stopped. No identity persistence/authentication, server, chat, screen sharing, TURN or cross-machine support exists in this version.

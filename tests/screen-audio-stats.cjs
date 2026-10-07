// Read-only diagnostics. Channel capability is deliberately separate from capture channels.
module.exports = async function screenAudioStats(page, previous = []) {
  return page.evaluate(async (previous) => {
    const t = window.__voiceTest,
      results = [];
    const localIds = new Set(
      t.displays.filter((s) => s.active).flatMap((s) => s.getAudioTracks().map((t) => t.id)),
    );
    const remoteIds = new Set(
      [...document.querySelectorAll(".spacevoice video")].flatMap(
        (v) => v.srcObject?.getAudioTracks().map((t) => t.id) || [],
      ),
    );
    function section(description, mid) {
      return (
        description?.sdp.split(/(?=^m=)/m).find((s) => s.includes("\na=mid:" + mid + "\r")) || ""
      );
    }
    for (const pc of t.pcs.filter((pc) => pc.connectionState !== "closed")) {
      const stats = await pc.getStats();
      for (const transceiver of pc.getTransceivers()) {
        for (const direction of ["outbound", "inbound"]) {
          const endpoint = direction === "outbound" ? transceiver.sender : transceiver.receiver,
            track = endpoint.track;
          if (
            !track ||
            track.kind !== "audio" ||
            !(direction === "outbound" ? localIds : remoteIds).has(track.id)
          )
            continue;
          const endpointStats = await endpoint.getStats();
          const rtps = [...endpointStats.values()].filter(
            (s) => s.type === direction + "-rtp" && s.kind === "audio",
          );
          for (const rtp of rtps) {
            if (rtp.mid !== undefined && String(rtp.mid) !== String(transceiver.mid)) continue;
            const codec = stats.get(rtp.codecId) || endpointStats.get(rtp.codecId);
            const remote =
              stats.get(rtp.remoteId) ||
              [...stats.values()].find(
                (s) =>
                  s.type ===
                    "remote-" + (direction === "outbound" ? "inbound" : "outbound") + "-rtp" &&
                  s.localId === rtp.id,
              );
            const transport = stats.get(rtp.transportId),
              pair = stats.get(transport?.selectedCandidatePairId);
            const key = pc.testId + ":" + direction + ":" + rtp.ssrc,
              old = previous.find((p) => p.key === key);
            const bytes = direction === "outbound" ? rtp.bytesSent : rtp.bytesReceived;
            const bitsPerSecond =
              old && rtp.timestamp > old.timestamp && bytes >= old.bytes
                ? (8 * (bytes - old.bytes) * 1000) / (rtp.timestamp - old.timestamp)
                : null;
            const remoteSdp = section(pc.remoteDescription, transceiver.mid),
              localSdp = section(pc.localDescription, transceiver.mid);
            const fmtp = codec?.sdpFmtpLine || "";
            const opusParameter = (name) =>
              fmtp.match(new RegExp("(?:^|;)\\s*" + name + "=([^;]+)"))?.[1] ?? null;
            results.push({
              key,
              direction,
              mid: transceiver.mid,
              trackId: track.id,
              trackSettings: track.getSettings(),
              trackConstraints: track.getConstraints(),
              parameters: endpoint.getParameters(),
              codec: codec
                ? {
                    mimeType: codec.mimeType,
                    clockRate: codec.clockRate,
                    codecChannels: codec.channels,
                    sdpFmtpLine: fmtp,
                    payloadType: codec.payloadType,
                  }
                : null,
              stereoPreference:
                codec?.mimeType.toLowerCase() === "audio/opus"
                  ? (opusParameter("stereo") ?? "not signalled (Opus default mono)")
                  : null,
              usedtx:
                codec?.mimeType.toLowerCase() === "audio/opus"
                  ? (opusParameter("usedtx") ?? "not signalled (Opus default off)")
                  : null,
              bytes,
              timestamp: rtp.timestamp,
              packets: direction === "outbound" ? rtp.packetsSent : rtp.packetsReceived,
              bitsPerSecond,
              packetsLost: rtp.packetsLost ?? remote?.packetsLost ?? null,
              jitterSeconds: rtp.jitter ?? remote?.jitter ?? null,
              roundTripTimeSeconds: remote?.roundTripTime ?? pair?.currentRoundTripTime ?? null,
              roundTripTimeSource:
                remote?.roundTripTime !== undefined
                  ? "audio RTCP"
                  : pair?.currentRoundTripTime !== undefined
                    ? "shared ICE transport"
                    : null,
              localAudioSdp: localSdp,
              remoteAudioSdp: remoteSdp,
              rtc: pc.connectionState,
              ice: pc.iceConnectionState,
              signaling: pc.signalingState,
            });
          }
        }
      }
    }
    return results;
  }, previous);
};

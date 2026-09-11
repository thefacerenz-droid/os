(function (root) {
  class VelCallPeer {
    constructor({ iceServers, localStream, onSignal, onStream, onState, Peer = root.RTCPeerConnection, Stream = root.MediaStream }) {
      this.peer = new Peer({ iceServers });
      this.stream = new Stream();
      this.pendingCandidates = [];
      this.offered = false;
      this.closed = false;
      this.onSignal = onSignal;
      this.senders = {};
      for (const kind of ["audio", "video"]) {
        const track = localStream.getTracks().find((item) => item.kind === kind);
        this.senders[kind] = this.peer.addTransceiver(track || kind, { direction: "sendrecv", streams: [localStream] }).sender;
      }
      this.peer.onicecandidate = ({ candidate }) => {
        if (candidate) onSignal({ type: "candidate", candidate: candidate.toJSON() }).catch((error) => onState("error", error));
      };
      this.peer.ontrack = ({ track, streams = [] }) => {
        // Safari is more reliable when the video element receives the stream supplied by WebRTC.
        if (streams[0]) this.stream = streams[0];
        else if (!this.stream.getTracks().some((item) => item.id === track.id)) this.stream.addTrack(track);
        track.onunmute = () => onStream(this.stream);
        track.onmute = () => onStream(this.stream);
        track.onended = () => onStream(this.stream);
        onStream(this.stream);
      };
      this.peer.onconnectionstatechange = () => onState(this.peer.connectionState);
    }
    async offer() {
      if (this.closed || this.offered || this.peer.signalingState !== "stable") return;
      this.offered = true;
      try {
        await this.peer.setLocalDescription(await this.peer.createOffer());
        await this.onSignal({ type: "description", description: { type: this.peer.localDescription.type, sdp: this.peer.localDescription.sdp } });
      } catch (error) { this.offered = false; throw error; }
    }
    async accept(signal) {
      if (this.closed) return;
      if (signal.type === "candidate") {
        if (this.peer.remoteDescription) await this.peer.addIceCandidate(signal.candidate);
        else this.pendingCandidates.push(signal.candidate);
        return;
      }
      const description = signal.description;
      // Only the lower user ID sends the initial offer; snapshots are processed serially.
      if (description.type === "answer" && this.peer.signalingState !== "have-local-offer") return;
      await this.peer.setRemoteDescription(description);
      for (const candidate of this.pendingCandidates.splice(0)) await this.peer.addIceCandidate(candidate);
      if (description.type === "offer") {
        await this.peer.setLocalDescription(await this.peer.createAnswer());
        await this.onSignal({ type: "description", description: { type: this.peer.localDescription.type, sdp: this.peer.localDescription.sdp } });
      }
    }
    async replaceVideo(track) { await this.senders.video.replaceTrack(track); }
    close() { this.closed = true; return this.peer.close(); }
  }
  if (typeof module !== "undefined" && module.exports) module.exports = VelCallPeer;
  else root.VelCallPeer = VelCallPeer;
})(typeof window === "undefined" ? globalThis : window);

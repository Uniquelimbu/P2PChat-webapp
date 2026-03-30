import { useEffect, useRef, useCallback } from "react";
import { useApp } from "@/context/app-context";
import type { DmMessage } from "@/context/app-context";
import { v4 as uuidv4 } from "uuid";

/**
 * useWebRTC — P2P Direct Peer Connections
 * 
 * This hook manages WebRTC peer connections for each peer in the room.
 * Messages are sent directly peer-to-peer via data channels, not relayed through the server.
 */

interface PeerConnection {
  peerId: string;
  peerName: string;
  peerIp: string;
  rtcConnection: RTCPeerConnection;
  dataChannels: {
    group?: RTCDataChannel;  // for group messages
    dm?: RTCDataChannel;     // for direct messages
  };
  isInitiator: boolean;
}

const STUN_SERVERS = [
  { urls: ["stun:stun.l.google.com:19302"] },
  { urls: ["stun:stun1.l.google.com:19302"] },
];

export function useWebRTC(signalingWs: WebSocket | null, myPeerId: string | null) {
  const { activeRoom, addLog, addMessage, addDmMessage, username } = useApp();
  
  const peerConnectionsRef = useRef<Map<string, PeerConnection>>(new Map());
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidate[]>>(new Map());
  const activeRoomRef = useRef(activeRoom);

  useEffect(() => {
    activeRoomRef.current = activeRoom;
  }, [activeRoom]);

  /**
   * Create RTCPeerConnection for a peer
   */
  const createPeerConnection = useCallback(
    (peerId: string, peerName: string, peerIp: string, isInitiator: boolean) => {
      if (!myPeerId) return null;

      const pc = new RTCPeerConnection({
        iceServers: STUN_SERVERS,
      });

      addLog({
        event: "RECEIVED",
        protocol: "WebRTC",
        frameType: "PEER_CONNECTION",
        payloadSize: 0,
        data: {
          action: "Creating peer connection",
          peerId,
          peerName,
          isInitiator,
        },
      });

      pc.onicecandidate = (event) => {
        if (event.candidate && signalingWs?.readyState === WebSocket.OPEN) {
          signalingWs.send(
            JSON.stringify({
              type: "signal:ice-candidate",
              targetPeerId: peerId,
              candidate: event.candidate,
            })
          );

          addLog({
            event: "SENT",
            protocol: "WebRTC",
            frameType: "ICE_CANDIDATE",
            payloadSize: 0,
            data: {
              to: peerName,
              candidate: event.candidate.candidate?.substring(0, 50),
            },
          });
        }
      };

      pc.onconnectionstatechange = () => {
        addLog({
          event: "RECEIVED",
          protocol: "WebRTC",
          frameType: "CONNECTION_STATE",
          payloadSize: 0,
          data: {
            peerId,
            peerName,
            state: pc.connectionState,
          },
        });

        if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
          peerConnectionsRef.current.delete(peerId);
        }
      };

      // If we're the initiator, create the data channels
      if (isInitiator) {
        const groupChannel = pc.createDataChannel("group-chat", { ordered: true });
        const dmChannel = pc.createDataChannel("direct-message", { ordered: true });

        const peerConn = peerConnectionsRef.current.get(peerId) || {
          peerId,
          peerName,
          peerIp,
          rtcConnection: pc,
          dataChannels: {},
          isInitiator,
        };

        peerConn.dataChannels.group = groupChannel;
        peerConn.dataChannels.dm = dmChannel;

        setupDataChannel(groupChannel, peerId, peerName, "group");
        setupDataChannel(dmChannel, peerId, peerName, "dm");

        peerConnectionsRef.current.set(peerId, peerConn);
      } else {
        // If we're not the initiator, listen for incoming data channels
        pc.ondatachannel = (event) => {
          const channel = event.channel;
          const channelType = channel.label === "group-chat" ? "group" : "dm";
          
          const peerConn = peerConnectionsRef.current.get(peerId) || {
            peerId,
            peerName,
            peerIp,
            rtcConnection: pc,
            dataChannels: {},
            isInitiator,
          };

          if (channelType === "group") {
            peerConn.dataChannels.group = channel;
          } else {
            peerConn.dataChannels.dm = channel;
          }

          setupDataChannel(channel, peerId, peerName, channelType);
          peerConnectionsRef.current.set(peerId, peerConn);
        };
      }

      return pc;
    },
    [myPeerId, signalingWs, addLog]
  );

  /**
   * Set up handlers for a data channel
   */
  const setupDataChannel = useCallback(
    (channel: RTCDataChannel, peerId: string, peerName: string, type: "group" | "dm") => {
      channel.onopen = () => {
        addLog({
          event: "RECEIVED",
          protocol: "WebRTC",
          frameType: "DATA_CHANNEL_OPEN",
          payloadSize: 0,
          data: { peerId, peerName, channelType: type },
        });
      };

      channel.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as Record<string, unknown>;
          const payloadSize = new Blob([event.data]).size;

          addLog({
            event: "RECEIVED",
            protocol: "WebRTC",
            frameType: type === "group" ? "DATA" : "DM",
            payloadSize,
            data: { from: peerName, ...data },
          });

          if (type === "group") {
            const incomingRoomId = data.roomId as string;
            const currentRoomId = activeRoomRef.current?.id;
            if (!currentRoomId || incomingRoomId !== currentRoomId) {
              addLog({
                event: "RECEIVED",
                protocol: "WebRTC",
                frameType: "ROOM_MISMATCH_DROP",
                payloadSize,
                data: { from: peerName, incomingRoomId, currentRoomId },
              });
              return;
            }

            // Group message
            addMessage({
              id: data.id as string,
              roomId: incomingRoomId,
              senderId: data.senderId as string,
              senderName: data.senderName as string,
              senderIp: data.senderIp as string,
              content: data.content as string,
              timestamp: data.timestamp as string,
              protocol: "WebRTC",
              frameType: "DATA",
              payloadSize,
              direction: "RECEIVED",
            });
          } else {
            // Direct message
            const dm: DmMessage = {
              id: data.id as string,
              senderId: data.senderId as string,
              senderName: data.senderName as string,
              senderIp: data.senderIp as string,
              targetId: myPeerId!,
              targetName: username || "You",
              content: data.content as string,
              timestamp: data.timestamp as string,
              direction: "RECEIVED",
            };
            addDmMessage(peerId, dm, false);
          }
        } catch (err) {
          console.error("Failed to parse data channel message:", err);
        }
      };

      channel.onerror = (event) => {
        addLog({
          event: "ERROR",
          protocol: "WebRTC",
          frameType: "DATA_CHANNEL_ERROR",
          payloadSize: 0,
          data: { peerId, peerName, error: event.error?.message },
        });
      };

      channel.onclose = () => {
        addLog({
          event: "RECEIVED",
          protocol: "WebRTC",
          frameType: "DATA_CHANNEL_CLOSE",
          payloadSize: 0,
          data: { peerId, peerName, channelType: type },
        });
      };
    },
    [addLog, addMessage, addDmMessage, myPeerId, username]
  );

  /**
   * Handle incoming SDP offer from another peer
   */
  const handleSignalingOffer = useCallback(
    async (offer: RTCSessionDescriptionInit, fromPeerId: string, fromName: string, fromIp: string) => {
      if (!myPeerId) return;

      try {
        let pc = peerConnectionsRef.current.get(fromPeerId)?.rtcConnection;
        if (!pc) {
          const newPc = createPeerConnection(fromPeerId, fromName, fromIp, false);
          if (!newPc) return;
          pc = newPc;
        }

        pc.ontrack = (event) => {
          addLog({
            event: "RECEIVED",
            protocol: "WebRTC",
            frameType: "TRACK",
            payloadSize: 0,
            data: { from: fromName, trackKind: event.track.kind },
          });
        };

        await pc.setRemoteDescription(new RTCSessionDescription(offer));

        // Apply any pending ICE candidates
        const pending = pendingCandidatesRef.current.get(fromPeerId) || [];
        for (const candidate of pending) {
          await pc.addIceCandidate(candidate);
        }
        pendingCandidatesRef.current.delete(fromPeerId);

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        // Send answer back via signaling server
        if (signalingWs?.readyState === WebSocket.OPEN) {
          signalingWs.send(
            JSON.stringify({
              type: "signal:answer",
              targetPeerId: fromPeerId,
              answer,
            })
          );

          addLog({
            event: "SENT",
            protocol: "WebRTC",
            frameType: "SDP_ANSWER",
            payloadSize: 0,
            data: { to: fromName },
          });
        }
      } catch (err) {
        console.error("Error handling SDP offer:", err);
      }
    },
    [myPeerId, signalingWs, createPeerConnection, addLog]
  );

  /**
   * Handle incoming SDP answer from another peer
   */
  const handleSignalingAnswer = useCallback(
    async (answer: RTCSessionDescriptionInit, fromPeerId: string, fromName: string) => {
      try {
        const peerConn = peerConnectionsRef.current.get(fromPeerId);
        if (!peerConn) return;

        await peerConn.rtcConnection.setRemoteDescription(new RTCSessionDescription(answer));

        // Apply any pending ICE candidates
        const pending = pendingCandidatesRef.current.get(fromPeerId) || [];
        for (const candidate of pending) {
          await peerConn.rtcConnection.addIceCandidate(candidate);
        }
        pendingCandidatesRef.current.delete(fromPeerId);

        addLog({
          event: "RECEIVED",
          protocol: "WebRTC",
          frameType: "SDP_ANSWER",
          payloadSize: 0,
          data: { from: fromName },
        });
      } catch (err) {
        console.error("Error handling SDP answer:", err);
      }
    },
    [addLog]
  );

  /**
   * Handle incoming ICE candidate from another peer
   */
  const handleIceCandidate = useCallback(
    async (candidate: RTCIceCandidate, fromPeerId: string) => {
      const peerConn = peerConnectionsRef.current.get(fromPeerId);

      if (!peerConn) {
        // Store candidate for later if connection hasn't been created yet
        if (!pendingCandidatesRef.current.has(fromPeerId)) {
          pendingCandidatesRef.current.set(fromPeerId, []);
        }
        pendingCandidatesRef.current.get(fromPeerId)!.push(candidate);
        return;
      }

      try {
        await peerConn.rtcConnection.addIceCandidate(candidate);
      } catch (err) {
        console.error("Error adding ICE candidate:", err);
      }
    },
    []
  );

  /**
   * Initiate connection to a new peer (we're the initiator)
   */
  const connectToPeer = useCallback(
    async (peerId: string, peerName: string, peerIp: string) => {
      if (!myPeerId) return;

      try {
        const pc = createPeerConnection(peerId, peerName, peerIp, true);
        if (!pc) return;

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        // Send offer via signaling server
        if (signalingWs?.readyState === WebSocket.OPEN) {
          signalingWs.send(
            JSON.stringify({
              type: "signal:offer",
              targetPeerId: peerId,
              offer,
            })
          );

          addLog({
            event: "SENT",
            protocol: "WebRTC",
            frameType: "SDP_OFFER",
            payloadSize: 0,
            data: { to: peerName },
          });
        }
      } catch (err) {
        console.error("Error creating offer:", err);
      }
    },
    [myPeerId, signalingWs, createPeerConnection, addLog]
  );

  /**
   * Send a group message to all peers in the room
   */
  const sendGroupMessage = useCallback(
    (content: string) => {
      const msg = {
        id: uuidv4(),
        roomId: activeRoom?.id || "",
        senderId: myPeerId || "",
        senderName: username || "Anonymous",
        senderIp: "127.0.0.1",
        content,
        timestamp: new Date().toISOString(),
      };

      const msgStr = JSON.stringify(msg);
      const payloadSize = new Blob([msgStr]).size;

      for (const peerConn of peerConnectionsRef.current.values()) {
        if (peerConn.dataChannels.group?.readyState === "open") {
          peerConn.dataChannels.group.send(msgStr);
        }
      }

      addLog({
        event: "SENT",
        protocol: "WebRTC",
        frameType: "DATA",
        payloadSize,
        data: msg,
      });

      addMessage({
        id: msg.id,
        roomId: msg.roomId,
        senderId: msg.senderId,
        senderName: msg.senderName,
        senderIp: msg.senderIp,
        content: msg.content,
        timestamp: msg.timestamp,
        protocol: "WebRTC",
        frameType: "DATA",
        payloadSize,
        direction: "SENT",
      });
    },
    [activeRoom, myPeerId, username, addLog, addMessage]
  );

  /**
   * Send a direct message to a specific peer
   */
  const sendDirectMessage = useCallback(
    (targetPeerId: string, content: string) => {
      const msg = {
        id: uuidv4(),
        senderId: myPeerId || "",
        senderName: username || "Anonymous",
        senderIp: "127.0.0.1",
        targetId: targetPeerId,
        content,
        timestamp: new Date().toISOString(),
      };

      const msgStr = JSON.stringify(msg);
      const payloadSize = new Blob([msgStr]).size;

      const peerConn = peerConnectionsRef.current.get(targetPeerId);
      if (peerConn?.dataChannels.dm?.readyState === "open") {
        peerConn.dataChannels.dm.send(msgStr);
      }

      addLog({
        event: "SENT",
        protocol: "WebRTC",
        frameType: "DM",
        payloadSize,
        data: msg,
      });

      if (peerConn?.dataChannels.dm?.readyState === "open") {
        const outgoingDm: DmMessage = {
          id: msg.id,
          senderId: msg.senderId,
          senderName: msg.senderName,
          senderIp: msg.senderIp,
          targetId: targetPeerId,
          targetName: peerConn.peerName,
          content: msg.content,
          timestamp: msg.timestamp,
          direction: "SENT",
        };
        addDmMessage(targetPeerId, outgoingDm, true);
      }
    },
    [myPeerId, username, addLog, addDmMessage]
  );

  /**
   * Disconnect from a peer
   */
  const disconnectFromPeer = useCallback((peerId: string) => {
    const peerConn = peerConnectionsRef.current.get(peerId);
    if (peerConn) {
      peerConn.rtcConnection.close();
      peerConnectionsRef.current.delete(peerId);
    }
  }, []);

  /**
   * Disconnect all peer connections (useful on room switches)
   */
  const disconnectAllPeers = useCallback(() => {
    for (const peerConn of peerConnectionsRef.current.values()) {
      peerConn.rtcConnection.close();
    }
    peerConnectionsRef.current.clear();
    pendingCandidatesRef.current.clear();
  }, []);

  /**
   * Get current peer connections for debugging
   */
  const getPeerConnections = useCallback(() => {
    return Array.from(peerConnectionsRef.current.entries()).map(([peerId, conn]) => ({
      peerId,
      peerName: conn.peerName,
      state: conn.rtcConnection.connectionState,
      isInitiator: conn.isInitiator,
    }));
  }, []);

  return {
    handleSignalingOffer,
    handleSignalingAnswer,
    handleIceCandidate,
    connectToPeer,
    sendGroupMessage,
    sendDirectMessage,
    disconnectFromPeer,
    disconnectAllPeers,
    getPeerConnections,
  };
}

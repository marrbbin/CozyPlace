import { useState, useEffect, useRef, useCallback } from 'react';
import Peer, { DataConnection } from 'peerjs';
import { Message, NetworkPayload, PeerState } from '../types';

// Helper to generate a random ID if one doesn't exist
const generateId = () => Math.random().toString(36).substr(2, 9);

export const useP2PChat = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [peerState, setPeerState] = useState<PeerState>({
    myId: '',
    isHost: false,
    connections: [],
    status: 'loading',
  });

  const peerRef = useRef<Peer | null>(null);
  const connectionsRef = useRef<{ [key: string]: DataConnection }>({});
  const processedMessageIds = useRef<Set<string>>(new Set());

  // Add message to local state
  const addMessage = useCallback((msg: Message) => {
    if (processedMessageIds.current.has(msg.id)) return;
    
    processedMessageIds.current.add(msg.id);
    setMessages((prev) => [...prev, msg]);
  }, []);

  // Send data to specific connection or broadcast to all
  const sendData = useCallback((data: NetworkPayload, targetConn?: DataConnection) => {
    if (targetConn) {
      targetConn.send(data);
    } else {
      Object.values(connectionsRef.current).forEach((conn) => {
        if (conn.open) {
          conn.send(data);
        }
      });
    }
  }, []);

  // Initialize Peer
  useEffect(() => {
    // Check for existing room ID in hash
    const hash = window.location.hash.replace('#', '');
    const isHost = !hash;
    
    // If Host: Generate ID. If Guest: Use random ID, but connect to Hash ID.
    const myId = isHost ? generateId() : generateId(); 
    
    // If hosting, set the hash so others can join
    if (isHost) {
      window.location.hash = myId;
    }

    const peer = new Peer(myId, {
      debug: 1,
    });

    peerRef.current = peer;

    peer.on('open', (id) => {
      console.log('My Peer ID:', id);
      setPeerState((prev) => ({ ...prev, myId: id, isHost, status: 'ready' }));

      // If we are a guest, connect to the host immediately
      if (!isHost && hash) {
        connectToHost(hash);
      }
    });

    peer.on('connection', (conn) => {
      handleConnection(conn);
    });

    peer.on('error', (err) => {
      console.error('Peer error:', err);
      // If ID is taken (rare with random generation) or network fail
      setPeerState((prev) => ({ ...prev, status: 'error' }));
    });

    // Cleanup
    return () => {
      peer.destroy();
      peerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connectToHost = (hostId: string) => {
    if (!peerRef.current) return;
    const conn = peerRef.current.connect(hostId, {
      reliable: true,
    });
    handleConnection(conn);
  };

  const handleConnection = (conn: DataConnection) => {
    conn.on('open', () => {
      console.log('Connected to:', conn.peer);
      connectionsRef.current[conn.peer] = conn;
      
      setPeerState((prev) => ({
        ...prev,
        connections: Object.keys(connectionsRef.current),
      }));

      // If I am the host, I should sync history or welcome the user (optional)
      // For simplicity, we just start chatting.
    });

    conn.on('data', (data: unknown) => {
      const payload = data as NetworkPayload;
      
      if (payload.type === 'CHAT_MESSAGE') {
        const msg = payload.payload as Message;
        
        // If we haven't seen this message, add it
        if (!processedMessageIds.current.has(msg.id)) {
          addMessage({ ...msg, isSelf: false });

          // RELAY LOGIC:
          // If I am the Host, I must broadcast this message to all other connected clients
          // so that Client B sees what Client C sent.
          if (peerRef.current && window.location.hash.includes(peerRef.current.id)) {
             // Broadcast to everyone EXCEPT the sender
             Object.values(connectionsRef.current).forEach(c => {
               if (c.peer !== conn.peer && c.open) {
                 c.send(payload);
               }
             });
          }
        }
      }
    });

    conn.on('close', () => {
      console.log('Connection closed:', conn.peer);
      delete connectionsRef.current[conn.peer];
      setPeerState((prev) => ({
        ...prev,
        connections: Object.keys(connectionsRef.current),
      }));
    });
  };

  const sendMessage = (text: string) => {
    if (!text.trim()) return;

    const newMessage: Message = {
      id: generateId(),
      text,
      senderId: peerState.myId,
      timestamp: Date.now(),
      isSelf: true,
      type: 'text',
    };

    addMessage(newMessage);
    
    // Broadcast to everyone connected
    sendData({
      type: 'CHAT_MESSAGE',
      payload: newMessage,
    });
  };

  return {
    messages,
    peerState,
    sendMessage,
  };
};
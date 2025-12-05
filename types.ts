export interface Message {
  id: string;
  text: string;
  senderId: string;
  timestamp: number;
  isSelf: boolean;
  type: 'text' | 'system';
}

export interface PeerState {
  myId: string;
  isHost: boolean;
  connections: string[]; // List of connected peer IDs
  status: 'loading' | 'ready' | 'error';
}

// Payload sent over the wire
export interface NetworkPayload {
  type: 'CHAT_MESSAGE' | 'HISTORY_SYNC';
  payload: any;
}
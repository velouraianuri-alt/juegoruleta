// Hand-written to match supabase/migrations/*.sql while the Supabase project is
// being provisioned. Once the project exists, regenerate with
// `mcp__supabase__generate_typescript_types` and replace this file — keep the
// shape (Tables/Enums/Functions) so imports elsewhere don't need to change.

export type FriendRequestStatus = "pending" | "accepted" | "declined";
export type RoomStatus = "waiting" | "playing" | "closed";
export type RoomPlayerStatus = "joined" | "left";
export type GameType = "roulette" | "blackjack";
export type RoundPhase =
  | "betting"
  | "player_turn"
  | "dealer_turn"
  | "settled"
  | "cancelled";
export type BlackjackHandStatus = "playing" | "stood" | "bust" | "blackjack";
export type WalletReason = "initial" | "bet" | "payout" | "free_chips";
export type RouletteBetType =
  | "straight"
  | "red"
  | "black"
  | "odd"
  | "even"
  | "low"
  | "high"
  | "dozen"
  | "column";

export interface Profile {
  id: string;
  username: string;
  avatar_url: string | null;
  virtual_balance: number;
  games_played: number;
  games_won: number;
  current_streak: number;
  best_streak: number;
  last_free_chips_at: string | null;
  created_at: string;
}

export interface FriendRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: FriendRequestStatus;
  created_at: string;
  responded_at: string | null;
}

export interface Room {
  id: string;
  code: string;
  name: string;
  owner_id: string;
  max_players: number;
  allowed_games: GameType[];
  status: RoomStatus;
  created_at: string;
}

export interface RoomPlayer {
  room_id: string;
  user_id: string;
  status: RoomPlayerStatus;
  seat_ready: boolean;
  joined_at: string;
  left_at: string | null;
}

export interface RoomMessage {
  id: string;
  room_id: string;
  user_id: string;
  message: string;
  created_at: string;
}

// `shoe` and `dealer_hole_card` are intentionally absent — SELECT is revoked on
// those columns for `authenticated` (see the RLS migration), so PostgREST never
// returns them to the client.
export interface GameRound {
  id: string;
  room_id: string;
  game_type: GameType;
  phase: RoundPhase;
  phase_ends_at: string | null;
  current_turn_hand_id: string | null;
  result: RouletteResult | BlackjackResult | null;
  dealer_hand: string[];
  created_at: string;
  settled_at: string | null;
}

export interface RouletteResult {
  number: number;
  color: "red" | "black" | "green";
}

export interface BlackjackResult {
  dealer_value: number;
  dealer_blackjack: boolean;
}

export interface RouletteBet {
  id: string;
  round_id: string;
  user_id: string;
  bet_type: RouletteBetType;
  bet_value: string | null;
  amount: number;
  payout: number | null;
  created_at: string;
}

export interface BlackjackHand {
  id: string;
  round_id: string;
  user_id: string;
  parent_hand_id: string | null;
  cards: string[];
  bet_amount: number;
  status: BlackjackHandStatus;
  is_double: boolean;
  payout: number | null;
  created_at: string;
}

export interface WalletTransaction {
  id: string;
  user_id: string;
  amount: number;
  balance_after: number;
  reason: WalletReason;
  round_id: string | null;
  created_at: string;
}

export interface Database {
  public: {
    Views: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
      friend_requests: {
        Row: FriendRequest;
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
      rooms: {
        Row: Room;
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
      room_players: {
        Row: RoomPlayer;
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [
          {
            foreignKeyName: "room_players_room_id_fkey";
            columns: ["room_id"];
            isOneToOne: false;
            referencedRelation: "rooms";
            referencedColumns: ["id"];
          },
        ];
      };
      room_messages: {
        Row: RoomMessage;
        Insert: Pick<RoomMessage, "room_id" | "user_id" | "message">;
        Update: Record<string, never>;
        Relationships: [];
      };
      game_rounds: {
        Row: GameRound;
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
      roulette_bets: {
        Row: RouletteBet;
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
      blackjack_hands: {
        Row: BlackjackHand;
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
      wallet_transactions: {
        Row: WalletTransaction;
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
    };
    Functions: {
      fn_claim_free_chips: { Args: Record<string, never>; Returns: Profile };
      fn_update_profile: {
        Args: { p_username: string; p_avatar_url: string | null };
        Returns: Profile;
      };
      fn_username_available: { Args: { p_username: string }; Returns: boolean };
      fn_get_email_for_username: { Args: { p_username: string }; Returns: string | null };
      fn_send_friend_request: {
        Args: { p_target_username: string };
        Returns: FriendRequest;
      };
      fn_respond_friend_request: {
        Args: { p_request_id: string; p_accept: boolean };
        Returns: FriendRequest;
      };
      fn_remove_friend: { Args: { p_friend_id: string }; Returns: void };
      fn_create_room: {
        Args: { p_name: string; p_max_players: number; p_allowed_games: GameType[] };
        Returns: Room;
      };
      fn_join_room: { Args: { p_code: string }; Returns: Room };
      fn_leave_room: { Args: { p_room_id: string }; Returns: void };
      fn_toggle_ready: { Args: { p_room_id: string; p_ready: boolean }; Returns: void };
      fn_start_game_session: { Args: { p_room_id: string }; Returns: Room };
      fn_end_game_session: { Args: { p_room_id: string }; Returns: Room };
      fn_send_room_message: {
        Args: { p_room_id: string; p_message: string };
        Returns: RoomMessage;
      };
      fn_start_roulette_round: { Args: { p_room_id: string }; Returns: GameRound };
      fn_place_roulette_bet: {
        Args: {
          p_round_id: string;
          p_bet_type: RouletteBetType;
          p_bet_value: string | null;
          p_amount: number;
        };
        Returns: RouletteBet;
      };
      fn_settle_roulette_round: { Args: { p_round_id: string }; Returns: GameRound };
      fn_start_blackjack_round: { Args: { p_room_id: string }; Returns: GameRound };
      fn_place_blackjack_bet: {
        Args: { p_round_id: string; p_amount: number };
        Returns: BlackjackHand;
      };
      fn_deal_blackjack: { Args: { p_round_id: string }; Returns: GameRound };
      fn_blackjack_hit: { Args: { p_hand_id: string }; Returns: BlackjackHand };
      fn_blackjack_stand: { Args: { p_hand_id: string }; Returns: BlackjackHand };
      fn_blackjack_double: { Args: { p_hand_id: string }; Returns: BlackjackHand };
      fn_blackjack_split: { Args: { p_hand_id: string }; Returns: BlackjackHand };
      fn_resolve_blackjack_round: { Args: { p_round_id: string }; Returns: GameRound };
    };
  };
}

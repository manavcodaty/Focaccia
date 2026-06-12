export type TicketStatus = 'claimed' | 'enrolled' | 'checked_in' | 'cancelled' | 'revoked';

export interface TicketType {
  capacity: number | null;
  checkout_available: boolean;
  currency: 'GBP';
  description: string;
  id: string;
  name: string;
  price_pence: number;
  remaining_capacity: number;
  sold_out: boolean;
  sort_order: number;
}

export interface PublicEvent {
  capacity: number;
  created_at: string;
  description: string;
  ends_at: string;
  event_id: string;
  is_listed: true;
  location: string;
  name: string;
  organizer: string;
  remaining_capacity: number;
  sold_out: boolean;
  starts_at: string;
  ticket_types: TicketType[];
}

export interface AttendeeProfile {
  email: string;
  full_name: string;
  user_id: string;
}

export interface OwnedTicket {
  cancelled_at: string | null;
  checked_in_at: string | null;
  claim_code: string;
  claim_code_hint: string;
  claimed_at: string;
  created_at: string;
  current_pass_id: string | null;
  enrolled_at: string | null;
  event: Pick<PublicEvent, 'ends_at' | 'event_id' | 'location' | 'name' | 'starts_at'> | null;
  event_id: string;
  generation_count: number;
  id: string;
  revoked_at: string | null;
  status: TicketStatus;
  ticket_type: Pick<TicketType, 'currency' | 'id' | 'name' | 'price_pence'> | null;
  ticket_type_id: string;
  updated_at: string;
}

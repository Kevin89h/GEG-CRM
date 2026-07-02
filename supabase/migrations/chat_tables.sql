-- Chat rooms (global + per document)
CREATE TABLE IF NOT EXISTS geg_guinee.chat_rooms (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  type        text NOT NULL DEFAULT 'global',  -- 'global' | 'order' | 'invoice'
  reference_id uuid,
  name        text NOT NULL,
  created_at  timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS chat_rooms_global_unique
  ON geg_guinee.chat_rooms (type) WHERE type = 'global';

CREATE UNIQUE INDEX IF NOT EXISTS chat_rooms_reference_unique
  ON geg_guinee.chat_rooms (type, reference_id) WHERE reference_id IS NOT NULL;

-- Messages
CREATE TABLE IF NOT EXISTS geg_guinee.chat_messages (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id     uuid NOT NULL REFERENCES geg_guinee.chat_rooms(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL,
  user_name   text NOT NULL,
  content     text NOT NULL,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_messages_room_created
  ON geg_guinee.chat_messages (room_id, created_at DESC);

-- Read receipts (last seen per user per room)
CREATE TABLE IF NOT EXISTS geg_guinee.chat_read_receipts (
  user_id     uuid NOT NULL,
  room_id     uuid NOT NULL REFERENCES geg_guinee.chat_rooms(id) ON DELETE CASCADE,
  last_read_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, room_id)
);

-- Grant permissions to service_role
GRANT ALL ON geg_guinee.chat_rooms TO service_role;
GRANT ALL ON geg_guinee.chat_messages TO service_role;
GRANT ALL ON geg_guinee.chat_read_receipts TO service_role;

-- Create the global room
INSERT INTO geg_guinee.chat_rooms (type, name)
VALUES ('global', 'Général')
ON CONFLICT DO NOTHING;

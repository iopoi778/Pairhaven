-- users
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE,
  password_hash text,
  name text,
  age int,
  gender text,
  bio text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- photos
CREATE TABLE photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  url text NOT NULL,
  public_id text,
  position int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- likes (who liked whom)
CREATE TABLE likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user uuid REFERENCES users(id),
  to_user uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE (from_user, to_user)
);

-- matches (mutual likes)
CREATE TABLE matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a uuid REFERENCES users(id),
  user_b uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now()
);

-- messages
CREATE TABLE messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid REFERENCES matches(id),
  sender uuid REFERENCES users(id),
  text text,
  created_at timestamptz DEFAULT now()
);

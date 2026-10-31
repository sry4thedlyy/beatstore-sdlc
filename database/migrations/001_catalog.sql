CREATE TABLE products (
    id uuid PRIMARY KEY,
    slug varchar(120) NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    title varchar(140) NOT NULL CHECK (length(btrim(title)) > 0),
    title_search text NOT NULL,
    description text NOT NULL,
    type text NOT NULL CHECK (type IN ('beat', 'drumkit')),
    publication_status text NOT NULL DEFAULT 'draft' CHECK (publication_status IN ('draft', 'published', 'archived')),
    genre varchar(80),
    bpm smallint CHECK (bpm > 0),
    musical_key varchar(30),
    cover_file_id uuid,
    demo_file_id uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (id, type),
    CHECK (publication_status <> 'published' OR (cover_file_id IS NOT NULL AND demo_file_id IS NOT NULL)),
    CHECK (publication_status <> 'published' OR type <> 'beat' OR (genre IS NOT NULL AND bpm IS NOT NULL AND musical_key IS NOT NULL))
);

CREATE TABLE product_files (
    id uuid PRIMARY KEY,
    product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    purpose text NOT NULL CHECK (purpose IN ('cover', 'demo', 'primary')),
    visibility text NOT NULL CHECK (visibility IN ('public', 'private')),
    storage_key text NOT NULL UNIQUE CHECK (storage_key <> ''),
    original_name varchar(180) NOT NULL,
    media_type text NOT NULL,
    byte_size bigint NOT NULL CHECK (byte_size > 0),
    sha256 char(64) NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (id, product_id),
    UNIQUE (id, product_id, purpose),
    CHECK ((purpose = 'primary' AND visibility = 'private') OR (purpose IN ('cover', 'demo') AND visibility = 'public')),
    CHECK ((purpose = 'cover' AND media_type IN ('image/png', 'image/jpeg'))
        OR (purpose = 'demo' AND media_type IN ('audio/wav', 'audio/mpeg'))
        OR (purpose = 'primary' AND media_type IN ('audio/mpeg', 'audio/wav', 'application/zip')))
);

ALTER TABLE products ADD CONSTRAINT product_cover_owner
    FOREIGN KEY (cover_file_id, id) REFERENCES product_files(id, product_id) ON DELETE RESTRICT;
ALTER TABLE products ADD CONSTRAINT product_demo_owner
    FOREIGN KEY (demo_file_id, id) REFERENCES product_files(id, product_id) ON DELETE RESTRICT;

CREATE TABLE purchase_variants (
    id uuid PRIMARY KEY,
    product_id uuid NOT NULL,
    product_type text NOT NULL,
    kind text NOT NULL CHECK (kind IN ('mp3', 'wav', 'trackout', 'exclusive', 'drumkit')),
    price numeric(12,2) NOT NULL CHECK (price > 0),
    currency char(3) NOT NULL DEFAULT 'RUB' CHECK (currency = 'RUB'),
    terms text NOT NULL,
    terms_version varchar(80) NOT NULL,
    template_version varchar(80) NOT NULL,
    UNIQUE (product_id, kind),
    UNIQUE (id, product_id),
    FOREIGN KEY (product_id, product_type) REFERENCES products(id, type) ON DELETE RESTRICT,
    CHECK ((product_type = 'beat' AND kind IN ('mp3', 'wav', 'trackout', 'exclusive'))
        OR (product_type = 'drumkit' AND kind = 'drumkit'))
);

CREATE TABLE variant_files (
    variant_id uuid NOT NULL,
    file_id uuid NOT NULL,
    product_id uuid NOT NULL,
    file_purpose text NOT NULL DEFAULT 'primary' CHECK (file_purpose = 'primary'),
    PRIMARY KEY (variant_id, file_id),
    FOREIGN KEY (variant_id, product_id) REFERENCES purchase_variants(id, product_id) ON DELETE RESTRICT,
    FOREIGN KEY (file_id, product_id, file_purpose) REFERENCES product_files(id, product_id, purpose) ON DELETE RESTRICT
);

CREATE INDEX products_publication_type ON products(publication_status, type);
CREATE INDEX product_files_product ON product_files(product_id);

CREATE FUNCTION protect_file_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW IS DISTINCT FROM OLD THEN
        RAISE EXCEPTION 'File versions are immutable; create a new version' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER immutable_file_version BEFORE UPDATE ON product_files
    FOR EACH ROW EXECUTE FUNCTION protect_file_version();

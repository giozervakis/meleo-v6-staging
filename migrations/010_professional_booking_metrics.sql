-- MELEO_PROFESSIONAL_BOOKING_METRICS_V1
--
-- D10K.11
--
-- Remove per-professional booking aggregation from the
-- professional discovery hot path while preserving exact
-- MELEO Trust semantics.
--
-- Lifetime counters are transactionally maintained by a
-- PostgreSQL trigger.
--
-- recent_completed remains time-correct without requiring a
-- booking write: each completed booking has an exact expiry
-- timestamp equal to created_at + 90 days.

CREATE TABLE professional_booking_metrics (
  professional_id text PRIMARY KEY
    REFERENCES professionals(id)
    ON DELETE CASCADE,

  total integer NOT NULL DEFAULT 0
    CHECK (total >= 0),

  completed integer NOT NULL DEFAULT 0
    CHECK (completed >= 0),

  cancelled integer NOT NULL DEFAULT 0
    CHECK (cancelled >= 0),

  progressed integer NOT NULL DEFAULT 0
    CHECK (progressed >= 0),

  updated_at timestamptz NOT NULL
    DEFAULT now()
);


CREATE TABLE professional_recent_completed_bookings (
  booking_id text PRIMARY KEY
    REFERENCES bookings(id)
    ON DELETE CASCADE,

  professional_id text NOT NULL
    REFERENCES professionals(id)
    ON DELETE CASCADE,

  expires_at timestamptz NOT NULL
);


CREATE INDEX
  professional_recent_completed_professional_expiry_idx
ON professional_recent_completed_bookings(
  professional_id,
  expires_at DESC
);


CREATE INDEX
  professional_recent_completed_expiry_idx
ON professional_recent_completed_bookings(
  expires_at
);


/*
 * ----------------------------------------------------------
 * INITIAL BACKFILL
 * ----------------------------------------------------------
 *
 * Include professionals with zero bookings so the relation
 * has one stable row per professional.
 */

INSERT INTO professional_booking_metrics(
  professional_id,
  total,
  completed,
  cancelled,
  progressed,
  updated_at
)

SELECT
  p.id,

  count(b.id)::int,

  count(b.id) FILTER(
    WHERE b.status='completed'
  )::int,

  count(b.id) FILTER(
    WHERE b.status='cancelled'
  )::int,

  count(b.id) FILTER(
    WHERE
      b.id IS NOT NULL
      AND b.status<>'pending'
  )::int,

  now()

FROM professionals p

LEFT JOIN bookings b
  ON b.professional_id=p.id

GROUP BY p.id;


INSERT INTO professional_recent_completed_bookings(
  booking_id,
  professional_id,
  expires_at
)

SELECT
  b.id,
  b.professional_id,
  b.created_at + interval '90 days'

FROM bookings b

WHERE
  b.status='completed'
  AND
  b.created_at + interval '90 days' >= now();


/*
 * ----------------------------------------------------------
 * LIFETIME COUNTER DELTA
 * ----------------------------------------------------------
 */

CREATE FUNCTION
  meleo_apply_booking_metric_delta(
    p_professional_id text,
    p_status text,
    p_delta integer
  )
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN

  IF
    p_professional_id IS NULL
    OR p_status IS NULL
    OR p_delta = 0
  THEN
    RETURN;
  END IF;


  IF p_delta > 0 THEN

    INSERT INTO professional_booking_metrics(
      professional_id,
      total,
      completed,
      cancelled,
      progressed,
      updated_at
    )
    VALUES(
      p_professional_id,

      1,

      CASE
        WHEN p_status='completed'
        THEN 1
        ELSE 0
      END,

      CASE
        WHEN p_status='cancelled'
        THEN 1
        ELSE 0
      END,

      CASE
        WHEN p_status<>'pending'
        THEN 1
        ELSE 0
      END,

      now()
    )

    ON CONFLICT(professional_id)
    DO UPDATE SET

      total =
        professional_booking_metrics.total +
        EXCLUDED.total,

      completed =
        professional_booking_metrics.completed +
        EXCLUDED.completed,

      cancelled =
        professional_booking_metrics.cancelled +
        EXCLUDED.cancelled,

      progressed =
        professional_booking_metrics.progressed +
        EXCLUDED.progressed,

      updated_at=now();

  ELSE

    UPDATE professional_booking_metrics

    SET
      total =
        GREATEST(
          0,
          total - 1
        ),

      completed =
        GREATEST(
          0,
          completed -
          CASE
            WHEN p_status='completed'
            THEN 1
            ELSE 0
          END
        ),

      cancelled =
        GREATEST(
          0,
          cancelled -
          CASE
            WHEN p_status='cancelled'
            THEN 1
            ELSE 0
          END
        ),

      progressed =
        GREATEST(
          0,
          progressed -
          CASE
            WHEN p_status<>'pending'
            THEN 1
            ELSE 0
          END
        ),

      updated_at=now()

    WHERE
      professional_id=
        p_professional_id;

  END IF;

END;
$$;


/*
 * ----------------------------------------------------------
 * BOOKING CHANGE TRIGGER
 * ----------------------------------------------------------
 *
 * Trigger execution is part of the transaction which mutates
 * bookings. Therefore booking state and derived metrics cannot
 * commit independently.
 */

CREATE FUNCTION
  meleo_sync_booking_metrics()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN

  IF TG_OP='INSERT' THEN

    PERFORM
      meleo_apply_booking_metric_delta(
        NEW.professional_id,
        NEW.status,
        1
      );


    IF
      NEW.status='completed'
      AND
      NEW.created_at + interval '90 days' >= now()
    THEN

      INSERT INTO
        professional_recent_completed_bookings(
          booking_id,
          professional_id,
          expires_at
        )
      VALUES(
        NEW.id,
        NEW.professional_id,
        NEW.created_at + interval '90 days'
      )

      ON CONFLICT(booking_id)
      DO UPDATE SET
        professional_id=
          EXCLUDED.professional_id,

        expires_at=
          EXCLUDED.expires_at;

    END IF;


    RETURN NEW;

  END IF;


  IF TG_OP='DELETE' THEN

    PERFORM
      meleo_apply_booking_metric_delta(
        OLD.professional_id,
        OLD.status,
        -1
      );


    DELETE FROM
      professional_recent_completed_bookings

    WHERE
      booking_id=OLD.id;


    RETURN OLD;

  END IF;


  /*
   * Ignore price-only or updated_at-only booking writes.
   */

  IF
    OLD.status IS NOT DISTINCT FROM NEW.status
    AND
    OLD.professional_id IS NOT DISTINCT FROM NEW.professional_id
    AND
    OLD.created_at IS NOT DISTINCT FROM NEW.created_at
  THEN
    RETURN NEW;
  END IF;


  /*
   * Remove the old contribution, then apply the new one.
   */

  PERFORM
    meleo_apply_booking_metric_delta(
      OLD.professional_id,
      OLD.status,
      -1
    );


  PERFORM
    meleo_apply_booking_metric_delta(
      NEW.professional_id,
      NEW.status,
      1
    );


  DELETE FROM
    professional_recent_completed_bookings

  WHERE
    booking_id=OLD.id;


  IF
    NEW.status='completed'
    AND
    NEW.created_at + interval '90 days' >= now()
  THEN

    INSERT INTO
      professional_recent_completed_bookings(
        booking_id,
        professional_id,
        expires_at
      )
    VALUES(
      NEW.id,
      NEW.professional_id,
      NEW.created_at + interval '90 days'
    )

    ON CONFLICT(booking_id)
    DO UPDATE SET
      professional_id=
        EXCLUDED.professional_id,

      expires_at=
        EXCLUDED.expires_at;

  END IF;


  RETURN NEW;

END;
$$;


CREATE TRIGGER
  bookings_professional_metrics_sync

AFTER
  INSERT
  OR DELETE
  OR UPDATE OF
    status,
    professional_id,
    created_at

ON bookings

FOR EACH ROW

EXECUTE FUNCTION
  meleo_sync_booking_metrics();

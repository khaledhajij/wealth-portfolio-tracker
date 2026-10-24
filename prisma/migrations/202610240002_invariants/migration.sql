-- Prisma schema cannot express these CHECK constraints or append-only triggers.
ALTER TABLE "Portfolio" ADD CONSTRAINT "Portfolio_usd_only"
  CHECK ("currency" = 'USD');

ALTER TABLE "Position" ADD CONSTRAINT "Position_valid_price"
  CHECK ("unitPrice" >= 0 AND "unitPrice" <> 'NaN'::numeric);
ALTER TABLE "Position" ADD CONSTRAINT "Position_cash_fixed_price"
  CHECK ("assetType" <> 'CASH' OR ("unitPrice" = 1 AND "symbol" = 'USD'));
ALTER TABLE "Position" ADD CONSTRAINT "Position_labels_nonempty"
  CHECK (length(btrim("label")) > 0 AND length(btrim("symbol")) > 0
    AND "symbol" = upper(btrim("symbol")));

ALTER TABLE "PositionMovement" ADD CONSTRAINT "PositionMovement_nonzero_finite"
  CHECK ("signedQuantity" <> 0 AND "signedQuantity" <> 'NaN'::numeric);
ALTER TABLE "PositionMovement" ADD CONSTRAINT "PositionMovement_request_key_nonempty"
  CHECK (length(btrim("requestKey")) > 0);

CREATE FUNCTION reject_position_movement_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'PositionMovement is append-only; record a correcting movement instead'
    USING ERRCODE = '23514';
  RETURN NULL;
END;
$$;

CREATE TRIGGER "PositionMovement_no_update_or_delete"
  BEFORE UPDATE OR DELETE ON "PositionMovement"
  FOR EACH STATEMENT EXECUTE FUNCTION reject_position_movement_mutation();

CREATE TRIGGER "PositionMovement_no_truncate"
  BEFORE TRUNCATE ON "PositionMovement"
  FOR EACH STATEMENT EXECUTE FUNCTION reject_position_movement_mutation();

-- These protect ordinary SQL, not a database owner able to drop/disable triggers.
-- Use a non-owner runtime role with no schema/trigger DDL privileges before exposure.

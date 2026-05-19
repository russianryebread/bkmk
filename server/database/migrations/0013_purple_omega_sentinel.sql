ALTER TABLE "images" ALTER COLUMN "data" SET DATA TYPE bytea USING decode("data", 'base64');

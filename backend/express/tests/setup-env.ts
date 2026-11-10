// Loaded by Jest before each test file (jest.config.js -> setupFiles).
// Fixed values so tests never depend on (or leak) the real .env:
// dotenv does not override variables that are already set.
process.env.SECRET_KEY = "938!938Ab";
process.env.omise_secret_key = "skey_test_jest_dummy";

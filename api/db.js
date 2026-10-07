const admin = require("firebase-admin");

if (!admin.apps.length) {
  const serviceAccount = {
    type: "service_account",
    project_id: "estudecforcc",
    private_key_id: "4328cf6932c53e9bca21df08996f0e6971e8f7e5",
    private_key:
      "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDepFNeOm7j960i\nU9AaLX3Eu5TNNipk4iY/TrQX7rvv5tAQSUH1wTnXT2nFxXsbAVGYZ7M+u950a5SJ\nEZ6x3bGv+gnS68AGp23cpZb9AlkvNj8CEdBwGe2zMU8D72eR/WexPqhtaffHpRCW\nCRMEvoLynk9sWP3SIx10IdTqna4trj9sLs7lkbNYiVUL8L4llp+o8aFqeN9hSndp\nXYDxb1+lZKnCrnRobzzVfAbtOgKrkCCNWdqJY3z/4GLJ6rcl0LETbSnLEyv9aU6o\nw5NgVQIDMMHLMkV5rX3ZxRT3CjMuRdTSxoKYCTFE15lZNo98BkDJ/5Ncaor2wH1h\ntUDYN3ILAgMBAAECggEABGyqcj/DSd33cEgzaudTZrwI+FX+UROIaFpzDEq1QovL\n7F9HoMSCvbXQ9CrlrwGpIyYAP69MhukPtGPjpEqMvm3K5MuBywcD+uc0kqNiqCnW\nHcIyAETVCGo2T474XFTWCDeQbCyQoS46+OPOZ9znceWQSKxdohHS7MJ1ceuiRe16\n15Dyxx/0AS2zbwtirnhfCfHk+Ib6J11+RIu9fNUshVBK+PeebioiYHRbxluXyeh6\ngpQI6tBunbff+YunTwCjoONiyJy2kjr7lMHhwAcOYkoZ5rVf397S73ljCG7EGUAD\niI5ySSD2PdZwoUtkZJx/FhepM0wYlhn5T8zotTJ2cQKBgQD1T3SLLkN5U0DnCMEI\nfDSENyxoYFWdG61MCgOtbZ0kx31Ri1WRhJgnSDEOaNMMHTHdAhpKrqN0f+JwIjd5\nHcP42jUsJ+0P+eJFgAs4tV4FbroHNjfTfZ+9i95vLMnT5RXmlUM/SRF7vxuMN7vs\n9TjYarPpPJu3VC+EZmpOjBOTWQKBgQDoV/5emt2Wq1L9+J26EM6T1O1sYzC40RIy\nFzG0OdgIHACi4CMap0px4UJyqc4GzEIZVyV5xnhFpM5qKKQB7yOtwwxZqaPqXPlG\nau4hHmbM74Etb9nUY1vrFDpeXNLEE3g7HKggvMENUE6K/9qnCcs8kY3MBJk49B1b\nHmQid+N4AwKBgH6h2JCsfipYPs3E6BjgPR/vd14eNLPYgLobBVD2n8NHs7pviemH\noB/PFXvRwvii7YWgO0BILJrMFXE7SJWeNvb0dbRom+i+Xv7vnVtVzMZTJXbplyH2\n3Io1dMrBPSLERGz2qnM13e+adLcKYlltMT4Ovvbs0ZluvOTFFaWci9JpAoGBAONA\ntd8IsHXfSsR4OKW2LKexmyvpdM1ASQDPaOEztpZv9TtZ6Vv3hrwOLLUEWyyQ+pHY\niCIsupS71t1EtO3jXk1lup20bEwd9f8nNZUVLE2EcR/lB/VR3aT32wNS3R/FP1Lp\n+5RRqq1//+K6z72TucKbR0rmsIthUZk/B4gjJUzLAoGAc0yt9JuqHuj1HXo5qJIQ\nQYKc5LzCKwPe76ULf0Pxt6wALcIPj3JZxBOAMmuZqbf49DMvUSHAcBkHm9g3s4n4\nXmGCMhtWJrbEIr1Gch3FiOP2FBz+GGKzEP6WfoV8m8NeHsn6SSxuJdReN5w9Y7aj\ns4vB/PmUYijA6wA1B12v4pE=\n-----END PRIVATE KEY-----\n",
    client_email:
      "firebase-adminsdk-fbsvc@estudecforcc.iam.gserviceaccount.com",
    client_id: "116469125569189768870",
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token",
    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
    client_x509_cert_url:
      "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40estudecforcc.iam.gserviceaccount.com",
    universe_domain: "googleapis.com",
  };

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

module.exports = { db, admin, FieldValue };

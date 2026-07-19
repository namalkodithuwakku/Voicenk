# Interpreter MVP Test Checklist

## Browser

Use Chrome or Edge on desktop or Android for the first test.

Microphone recording requires either:

- `http://localhost:3000`, or
- a secure HTTPS deployment.

## Tests

1. Open the app without signing in.
2. Confirm Interpreter opens first.
3. Select English as Speaker and French as Listener.
4. Hold the microphone for at least one second.
5. Speak a short sentence.
6. Release the button.
7. Confirm the original transcript appears.
8. Confirm the translated text appears.
9. Confirm translated voice plays automatically.
10. Tap Play again.
11. Tap Stop voice while audio is playing.
12. Hold the microphone again and confirm the previous result is replaced.
13. Switch the languages and repeat.
14. Select Auto detect as the Speaker language.
15. Deny microphone permission and confirm a clear error appears.
16. Record silence or a very short clip and confirm retry guidance appears.
17. Run lint and build.

```bash
npm run lint
npm run build
```

## Important language note

The language list is broad, but recognition and generated voice quality can
vary by language and accent. Sinhala, Tamil, names, dates, rates, currencies,
hotel names, and mixed-language speech require real-world testing before a
public quality claim.

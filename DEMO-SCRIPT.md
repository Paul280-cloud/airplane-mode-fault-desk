# Demo script: Airplane Mode Fault Desk (about 3 minutes)

## Before you record (10 minutes)

- [ ] Models downloaded: `npm run prefetch` finished once while online
- [ ] Terminal font large (at least 18 pt), dark background, window wide
- [ ] Notifications off (Do Not Disturb)
- [ ] These commands in a text file, ready to paste:
  1. `npm run desk -- "The street light on 5th Avenue keeps flickering and has been dark since Monday. Call me on 082 555 0134."`
  2. `npm run desk -- "Hay un bache enorme en la avenida Central, un coche ya se dañó una rueda."`
  3. `npm run desk -- "There is a live wire hanging low outside my house and it is sparking. My name is Thandeka Mokoena."`
- [ ] Do one full rehearsal with Wi-Fi off. Time it.
- [ ] Practise the first sentence until you can say it without looking.

## The script

**0:00 The problem (20 s)**
"In many communities, reporting a broken streetlight or a water leak means sending your phone number, your name and your location to a server somewhere. Data is expensive and privacy matters. I built a fault desk that works with no internet at all."

**0:20 Go offline, on camera (15 s)**
Show the screen with the Wi-Fi menu. Turn Wi-Fi **off**. Say: "Wi-Fi is off. Nothing here can reach the cloud."

**0:35 Demo 1: English report with a phone number (40 s)**
Paste command 1. While it runs: "This is how a resident might really write." When it prints, point at each line:
- "The phone number is already hidden. This happens first, before any AI sees the text."
- "It found the fault type: Faulty streetlight."
- "It wrote a short summary and picked the street out of the sentence."
- Point at `Network: OFFLINE`.

**1:15 Demo 2: Spanish report (30 s)**
Paste command 2. "Same thing in Spanish. It translated it on this laptop, then matched it to Pothole."

**1:45 Demo 3: urgent and names (30 s)**
Paste command 3. "A live wire. The tool marks it urgent and tells you why. And the name is masked."

**2:15 How it works (30 s)**
"Three small local models from the QVAC SDK: one translates, one matches the report to a fault type, one writes the summary. The privacy step and the urgency rules are plain code, so I can explain every decision."

**2:45 Honest limits and close (15 s)**
"It handles English and Spanish, name masking is simple, and a person should check low-confidence matches. It is MIT licensed, and the repo has a README anyone can follow. Thank you."

## If something goes wrong on camera

- **First model load is slow:** say "the models load once, then each report takes a moment." Cut it in editing.
- **A wrong fault type:** say "this is why it shows a confidence label and asks a person to check low-confidence ones." That is a strength, not a failure.
- **Command not found / error:** stop, fix, and re-record. Do not talk through an error.

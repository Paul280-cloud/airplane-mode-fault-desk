# Demo script: Airplane Mode Fault Desk (about 3 minutes)

Every report below was tested on a real run. Say the words in your own voice; short sentences are fine.

## 1. Set up (10 minutes, before you record)

**Computer**
- [ ] Plug in the charger. Close other apps. Turn on Do Not Disturb (Control Centre, Focus).
- [ ] Terminal: dark background, **big text** (press Cmd and + until you can read it from across the room). Make the window wide.
- [ ] Open the project folder: `cd ~/Downloads/GAIC-First-Local-Model/airplane-mode-fault-desk && eval "$(fnm env)" && fnm use 22.21.1`
- [ ] Start live mode now, **while online**: `npm run live`. Wait for the line `Ready.` (about 1 minute). The models stay loaded, so this wait is not in your video.
- [ ] Keep the Wi-Fi menu (top right of the screen) visible, so viewers can see you switch it off.

**Reports ready to paste** (keep them in a Notes file, one per line)
1. `The street light on 5th Avenue keeps flickering and has been dark since Monday. Call me on 082 555 0134.`
2. `Hay un bache enorme en la avenida Central, un coche ya se dañó una rueda.`
3. `There is a live wire hanging low outside my house and it is sparking. My name is Thandeka Mokoena.`

**Recording (Mac)**
- Press **Cmd + Shift + 5**, choose **Record Entire Screen** (or Selected Portion around the Terminal and the Wi-Fi icon), open **Options**, and set the microphone to **MacBook Air Microphone**. Click **Record**.
- To stop: click the stop icon in the menu bar (or Cmd + Control + Esc). The video saves on your Desktop.
- Do one full practice run first and watch it back. Check your voice is loud enough and the text is readable.

## 2. The script

**0:00 The problem (20 s)**
"When a resident reports a broken streetlight or a water leak, they often send their phone number and name to a server somewhere. Data is expensive, and privacy matters. So I built a fault desk that works with **no internet at all**."

**0:20 Go offline, on camera (15 s)**
Point at the Wi-Fi icon. Click it and switch Wi-Fi **off**. Say: "Wi-Fi is off. Nothing here can reach the cloud." The models are already loaded, so nothing breaks.

**0:35 Report 1: English with a phone number (40 s)**
Paste report 1 at `Report>` and press Enter. While it runs (2 to 4 seconds): "This is how a resident might really write." When the result prints, point at each line with the mouse:
- "**Network: OFFLINE**. This ran on my laptop."
- "The phone number is hidden. That happens first, before any AI sees the text."
- "It found the fault type: Faulty streetlight."
- "It picked out the location: 5th Avenue."

**1:15 Report 2: Spanish (30 s)**
Paste report 2. "Same thing in Spanish. It translated it here on the laptop, then matched it to Pothole. And it's not urgent."

**1:45 Report 3: danger and a name (30 s)**
Paste report 3. "A live wire. It's marked **urgent**, and it tells me why. The name is hidden too."

**2:15 How it works (30 s)**
"Three small local models from the QVAC SDK: one translates, one matches the report to a fault type, one writes the summary. The privacy hiding and the urgency rules are plain code, so I can explain every decision. And if the small model invents a place, a check removes it."

**2:45 Honest limits and close (15 s)**
"It handles English and Spanish. Name hiding is simple. The summary from the small model should always be checked by a person. It is open source under the MIT licence, and the README lets a stranger run it. Thank you."

Type `exit` to stop. Turn the Wi-Fi back on after you stop recording.

## 3. If something goes wrong on camera

- **It's slow the first time:** say "the models are loaded, so each report takes a few seconds." Cut the wait out later, or just wait.
- **A wrong fault type:** say "this is why it shows a confidence label and asks a person to check low-confidence ones." That's the design, not a failure.
- **The summary adds a word that isn't in the report** (the small model sometimes does): say "the summary is a convenience, the fault type, urgency and masking are the parts I rely on."
- **An error or a crash:** stop, run `npm run live` again, and re-record. Don't talk through an error.
- **You forget the words:** read the report out loud and describe what's on screen. That's enough.

## 4. After recording

- [ ] Watch it once with sound on. Is the text readable? Is your voice clear? Does it show Network: OFFLINE?
- [ ] Upload it (YouTube unlisted, Google Drive link, or Loom) and copy the link.
- [ ] Add the link to the README (a line under the title: "Demo video: <link>") and push:
  `git add -A && git commit -m "docs: add demo video link" && git push`
- [ ] Post the link in the bootcamp channel.

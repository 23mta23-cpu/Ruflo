# Lebenszeichen des Autonom-Loops

Eine Zeile pro Lauf, geschrieben von der Routine „Werkant Autonom-Loop"
(täglich 06:00 UTC / 08:00 Berlin). Zweck: den Unterschied zwischen
**„gelaufen, nichts zu tun"** und **„gar nicht gelaufen"** sichtbar machen.

Diese Unterscheidung ist in diesem Projekt zweimal teuer geworden — die
`health`-Function war nie deployt und ihr Workflow wertete 404 als Warnung
(#145), und diese Routine selbst fiel vom 19. bis 27.07. aus, ohne dass es
jemandem auffiel. Von außen sieht ein stiller Ausfall genauso aus wie
korrektes Nichtstun.

**So liest man die Datei:** Steht für gestern keine Zeile, ist die Routine
nicht gelaufen. Das ist ein Befund, keine Kleinigkeit.

Format:

    <ISO-Zeit UTC> | Lauf gestartet | offene Blöcke: <n>
    <ISO-Zeit UTC> | <Block erledigt / nichts offen / abgebrochen: Grund>

---

2026-07-29T17:30:00Z | Warteschlange durch interaktive Sitzung neu gefüllt (Q1-Q6), Heartbeat eingeführt

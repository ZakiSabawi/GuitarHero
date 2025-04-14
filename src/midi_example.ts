import * as Tone from "tone";
import { SampleLibrary } from "./tonejs-instruments";

const samples = SampleLibrary.load({
    instruments: SampleLibrary.list,
    baseUrl: "samples/",
});

Tone.ToneAudioBuffer.loaded().then(() => {
    for (const instrument in samples) {
        samples[instrument].toDestination();
        samples[instrument].release = 0.5;
    }
    play_instrument();
});

function play_instrument() {
    // Example 1: Playing a note with the "piano" sample
    // This triggers the attack of a note in the "piano" sampler, converting
    // MIDI note 36 to a frequency (C2) and playing it at a quarter of the
    // maximum velocity.
    samples["piano"].triggerAttack(
        Tone.Frequency(36, "midi").toNote(), // Convert MIDI note to frequency
        undefined, // Use default time for note onset
        0.25, // Set velocity to quarter of the maximum velocity
    );

    // After 1 second, stop the note (trigger release)
    setTimeout(() => {
        samples["piano"].triggerRelease(
            Tone.Frequency(36, "midi").toNote(), // Convert MIDI note to frequency
        );
    }, 1000);

    // Example 2: Playing a note with the "guitar-acoustic" sample
    // This triggers the attack and release of a note in the "guitar-acoustic" sampler.
    // The note is played for 1 second.
    samples["guitar-acoustic"].triggerAttackRelease(
        Tone.Frequency(36, "midi").toNote(), // Convert MIDI note to frequency
        1, // Duration of the note in seconds
        undefined, // Use default time for note onset
        0.25, // Set velocity to quarter of the maximum velocity
    );
}

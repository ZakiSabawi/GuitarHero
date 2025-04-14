/**
 * Inside this file you will use the classes and functions from rx.js
 * to add visuals to the svg element in index.html, animate them, and make them interactive.
 *
 * Study and complete the tasks in observable exercises first to get ideas.
 *
 * Course Notes showing Asteroids in FRP: https://tgdwyer.github.io/asteroids/
 *
 * You will be marked on your functional programming style
 * as well as the functionality that you implement.
 *
 * Document your code!
 */

import "./style.css";

import { from, fromEvent, interval, merge, timer } from "rxjs";
import { map, filter, scan, sample } from "rxjs/operators";
import * as Tone from "tone";
import { SampleLibrary } from "./tonejs-instruments";
import { not } from "rxjs/internal/util/not";
import { doc } from "prettier";

/** Constants */

const SAMPLES = SampleLibrary.load({
    instruments: [
        "bass-electric",
        "bassoon",
        "cello",
        "clarinet",
        "contrabass",
        "flute",
        "french-horn",
        "guitar-acoustic",
        "guitar-electric",
        "guitar-nylon",
        "harmonium",
        "harp",
        "organ",
        "piano",
        "saxophone",
        "trombone",
        "trumpet",
        "tuba",
        "violin",
        "xylophone",
    ], // SampleLibrary.list,
    baseUrl: "samples/",
});

const Viewport = {
    CANVAS_WIDTH: 200,
    CANVAS_HEIGHT: 400,
} as const;

const Constants = {
    TICK_RATE_MS: 12,
    PLAYABLE_TIME: 335,
    DEATH_TIME: 380,
    RED_NOTE: {
        x: 40,
        y: 350,
        userPlayed: false,
        instrumentName: "piano",
        velocity: 0,
        pitch: 57,
        start: 0,
        end: 0,
        played: false,
        hitable: false,
    },
    GREEN_NOTE: {
        x: 20,
        y: 350,
        userPlayed: false,
        instrumentName: "piano",
        velocity: 0,
        pitch: 56,
        start: 0,
        end: 0,
        played: false,
        hitable: false,
    },
    BLUE_NOTE: {
        x: 60,
        y: 350,
        userPlayed: false,
        instrumentName: "piano",
        velocity: 0,
        pitch: 58,
        start: 0,
        end: 0,
        played: false,
        hitable: false,
    },
    YELLOW_NOTE: {
        x: 80,
        y: 350,
        userPlayed: false,
        instrumentName: "piano",
        velocity: 0,
        pitch: 59,
        start: 0,
        end: 0,
        played: false,
        hitable: false,
    },
    INSTRUMENTS: [
        "bass-electric",
        "bassoon",
        "cello",
        "clarinet",
        "contrabass",
        "flute",
        "french-horn",
        "guitar-acoustic",
        "guitar-electric",
        "guitar-nylon",
        "harmonium",
        "harp",
        "organ",
        "piano",
        "saxophone",
        "trombone",
        "trumpet",
        "tuba",
        "violin",
        "xylophone",
    ],
} as const;

const Note = {
    RADIUS: 0.07 * Viewport.CANVAS_WIDTH,
    TAIL_WIDTH: 10,
};

/** User input */

type Key = "KeyH" | "KeyJ" | "KeyK" | "KeyL" | "KeyE" | "KeyR";

/** Utility functions */

/** State processing */

type State = Readonly<{
    gameEnd: boolean;
    gameStart: boolean;
    score: number;
    multiplier: number;
    combo: number;
    notes: ReadonlyArray<NoteData>;
    playerNotesH: ReadonlyArray<NoteData>;
    playerNotesJ: ReadonlyArray<NoteData>;
    playerNotesK: ReadonlyArray<NoteData>;
    playerNotesL: ReadonlyArray<NoteData>;
    currentTime: number;
}>;

const initialState: State = {
    gameEnd: false,
    gameStart: false,
    score: 0,
    combo: 0,
    multiplier: 1,
    notes: [],
    playerNotesH: [],
    playerNotesJ: [],
    playerNotesK: [],
    playerNotesL: [],
    currentTime: 0,
} as const;

type NoteData = {
    x: number;
    y: number;
    userPlayed: boolean;
    instrumentName: string;
    velocity: number;
    pitch: number;
    start: number;
    end: number;
    played: boolean;
    hitable: boolean;
};

/** Rendering (side effects) */

/**
 * Displays a SVG element on the canvas. Brings to foreground.
 * @param elem SVG element to display
 */
const show = (elem: SVGGraphicsElement) => {
    elem.setAttribute("visibility", "visible");
    elem.parentNode!.appendChild(elem);
};

/**
 * Hides a SVG element on the canvas.
 * @param elem SVG element to hide
 */
const hide = (elem: SVGGraphicsElement) =>
    elem.setAttribute("visibility", "hidden");

/**
 * Hides a Button element on the canvas.
 * @param elem Button element to hide
 */
const hideButton = (elem: HTMLButtonElement) => {
    elem.style.display = "none";
};

/**
 * Creates an SVG element with the given properties.
 *
 * See https://developer.mozilla.org/en-US/docs/Web/SVG/Element for valid
 * element names and properties.
 *
 * @param namespace Namespace of the SVG element
 * @param name SVGElement name
 * @param props Properties to set on the SVG element
 * @returns SVG element
 */
const createSvgElement = (
    namespace: string | null,
    name: string,
    props: Record<string, string> = {},
) => {
    const elem = document.createElementNS(namespace, name) as SVGElement;
    Object.entries(props).forEach(([k, v]) => elem.setAttribute(k, v));
    return elem;
};

/**
 * This is the function called on page load. Your main game loop
 * should be called here.
 */
export function main(
    csvContents: string,
    samples: { [key: string]: Tone.Sampler },
    initialState: State,
) {
    // Canvas elements

    const svg = document.querySelector("#svgCanvas") as SVGGraphicsElement &
        HTMLElement;

    const preview = document.querySelector(
        "#svgPreview",
    ) as SVGGraphicsElement & HTMLElement;
    const gameover = document.querySelector("#gameOver") as SVGGraphicsElement &
        HTMLElement;
    const container = document.querySelector("#main") as HTMLElement;

    svg.setAttribute("height", `${Viewport.CANVAS_HEIGHT}`);
    svg.setAttribute("width", `${Viewport.CANVAS_WIDTH}`);

    // Text fields
    const multiplier = document.querySelector("#multiplierText") as HTMLElement;
    const scoreText = document.querySelector("#scoreText") as HTMLElement;
    const comboText = document.querySelector("#comboText") as HTMLElement;

    //Get the keypresses
    const key$ = fromEvent<KeyboardEvent>(document, "keypress");

    // Filter keypresses
    const fromKey = (keyCode: Key) =>
        key$.pipe(filter(({ code }) => code === keyCode));

    // Merge keypresses into a single stream
    const action$ = merge(
        fromKey("KeyH").pipe(map(() => new hPressed())),
        fromKey("KeyJ").pipe(map(() => new jPressed())),
        fromKey("KeyK").pipe(map(() => new kPressed())),
        fromKey("KeyL").pipe(map(() => new lPressed())),
        fromKey("KeyE").pipe(map(() => new endGame())),
        fromKey("KeyR").pipe(map(() => new reset())),
    );

    /** Determines the rate of time steps */
    const tick$ = interval(Constants.TICK_RATE_MS);

    /**
     * Renders the current state to the canvas.
     *
     * In MVC terms, this updates the View using the Model.
     *
     * @param s Current state
     */
    const rect = createSvgElement(svg.namespaceURI, "rect", {
        x: "0",
        y: "365",
        z: "999",
        width: `${Viewport.CANVAS_WIDTH + 10}`,
        height: `${Viewport.CANVAS_HEIGHT - 360}`,
        fill: "rgba(161,161,161,1)",
    });
    const render = (s: State) => {
        //svg.appendChild(greenCircle);
        //console.log("rendering");

        //Remove all svg children with the name playerCircle
        const circles = svg.querySelectorAll("circle");
        circles.forEach((circle) => circle.remove());

        //Re add the permanent SVG elemnts that are needed
        addSVGNote(Constants.RED_NOTE, svg);
        addSVGNote(Constants.GREEN_NOTE, svg);
        addSVGNote(Constants.BLUE_NOTE, svg);
        addSVGNote(Constants.YELLOW_NOTE, svg);
        svg.querySelectorAll("rect").forEach((rect) => {
            rect.remove();
        });

        // Add the notes to the canvas
        s.playerNotesH.forEach((note) => {
            if (!note.played) {
                addSVGNote(note, svg);
            }
        });

        s.playerNotesJ.forEach((note) => {
            if (!note.played) {
                addSVGNote(note, svg);
            }
        });

        s.playerNotesK.forEach((note) => {
            if (!note.played) {
                addSVGNote(note, svg);
            }
        });

        s.playerNotesL.forEach((note) => {
            if (!note.played) {
                addSVGNote(note, svg);
            }
        });

        // Adding a rectangle to hide the notes that are at the bottom of the screen before they disapear
        svg.appendChild(rect);

        // Update text fields
        scoreText.textContent = `${Math.floor(s.score)}`;
        multiplier.textContent = `${s.multiplier.toFixed(1)}x`;
        comboText.textContent = `${s.combo} in a row`;
    };

    // Merge all streams together
    const source$ = merge(
        // Every Tick do the TickAction
        tick$.pipe(map(() => new TickAction())),
        // pipe all merged actions that where done in a tick
        action$,
    )
        .pipe(
            //Scan the state with the actions and apply them all and return a new state
            scan((s: State, action: Action) => action.apply(s), initialState),
            //Subscribe to the state and render it
        )
        .subscribe((s: State) => {
            render(s);

            //If the game ends show the game over screen
            if (s.gameEnd) {
                show(gameover);
            } else {
                hide(gameover);
            }
        });
}

// The following simply runs your main function on window load.  Make sure to leave it in place.
// You should not need to change this, beware if you are.
if (typeof window !== "undefined") {
    const startGame = (contents: string) => {
        //Parse the CSV and put it in all Notes
        const allNotes = parseCSV(contents);

        //Get the initial starting state by adding the Background Notes, Filter the player notes by column
        const updatedState = {
            ...initialState,
            gameStart: true,
            notes: allNotes.filter((note) => !note.userPlayed),
            playerNotesH: filterNotes(allNotes, 20),
            playerNotesJ: filterNotes(allNotes, 40),
            playerNotesK: filterNotes(allNotes, 60),
            playerNotesL: filterNotes(allNotes, 80),
        };

        main(contents, SAMPLES, updatedState);
    };

    const { protocol, hostname, port } = new URL(import.meta.url);
    const baseUrl = `${protocol}//${hostname}${port ? `:${port}` : ""}`;

    //Get the buttons
    const startSong1 = document.querySelector("#Song1") as HTMLButtonElement;
    const startSong2 = document.querySelector("#Song2") as HTMLButtonElement;
    const startSong3 = document.querySelector("#Song3") as HTMLButtonElement;

    /**
     * Starts the the game using the song
     *
     * @param song Name of the song the user wants to play
     */
    function startSong(song: String) {
        Tone.ToneAudioBuffer.loaded().then(() => {
            for (const instrument in SAMPLES) {
                SAMPLES[instrument].toDestination();
                SAMPLES[instrument].release = 0.5;
            }

            fetch(`${baseUrl}/assets/${song}.csv`)
                .then((response) => response.text())
                .then((text) => startGame(text))
                .catch((error) =>
                    console.error("Error fetching the CSV file:", error),
                );
        });

        //Hide the Song buttons as if clicked after the game start it crashes
        hideButton(startSong1);
        hideButton(startSong2);
        hideButton(startSong3);
    }

    //Set the on click on every button with song names
    startSong1.onclick = () => startSong("RockinRobin");
    startSong2.onclick = () => startSong("amongus");
    startSong3.onclick = () => startSong("LaufeyDreamer");
}

/*
Action interface That will be used to create every action that will be used in the game
/** */
interface Action {
    apply(s: State): State;
}

/** When the L key is pressed this action will edit the state of the game
 *
 * first it checks if the player is doing a valid click aka the note is hitable and not played
 * If so it plays the note and marks it as played and returns the new state with a higher score and combo and multiplier if need be
 * If not it returns the state with a lower score and combo and plays a random note
 *
 */
class lPressed implements Action {
    apply(s: State): State {
        //If the game is over return the state
        if (s.gameEnd) {
            return s;
        }
        //Map over all the notes and check if they are hitable and not played
        const updatedPlayerNotesL = s.playerNotesL.map((note) => {
            //Make sure there is a note and not an empty array
            if (note) {
                //Check if the note is hitable and not played
                if (note.hitable && !note.played) {
                    //Play Note
                    playNoteAtTime(
                        note,
                        SAMPLES as { [key: string]: Tone.Sampler },
                        Tone.now(),
                    );
                    // Mark all hitable notes as played
                    return { ...note, played: true };
                }
            }
            //Else keep note unchanged
            return note;
        });

        //If The button was pressed yet no note was played means an incorrect button press
        const notesPlayed = updatedPlayerNotesL.filter(
            (note) => note.played,
        ).length;

        //If incorrect play a random note
        if (!notesPlayed) {
            //Seed is based on the current time
            playRandomNote(s.currentTime);
        }

        //If correct return the new state with a higher score and combo and multiplier if need be else
        //return the state with a lower score and combo and reset multiplier
        return notesPlayed > 0
            ? {
                  ...s,
                  score: s.score + notesPlayed * s.multiplier,
                  combo: s.combo + notesPlayed,
                  multiplier: 1 + Math.floor(s.combo / 10) * 0.2,
                  playerNotesL: updatedPlayerNotesL,
              }
            : { ...s, score: s.score - 1, combo: 0 };
    }
}

/** When the L key is pressed this action will edit the state of the game
 *
 * first it checks if the player is doing a valid click aka the note is hitable and not played
 * If so it plays the note and marks it as played and returns the new state with a higher score and combo and multiplier if need be
 * If not it returns the state with a lower score and combo and plays a random note
 *
 */
class kPressed implements Action {
    apply(s: State): State {
        //If the game is over return the state
        if (s.gameEnd) {
            return s;
        }
        //Map over all the notes and check if they are hitable and not played
        const updatedPlayerNotesK = s.playerNotesK.map((note) => {
            //Make sure there is a note and not an empty array
            if (note) {
                //Check if the note is hitable and not played
                if (note.hitable && !note.played) {
                    //Play Note
                    playNoteAtTime(
                        note,
                        SAMPLES as { [key: string]: Tone.Sampler },
                        Tone.now(),
                    );
                    // Mark all hitable notes as played
                    return { ...note, played: true };
                }
            }
            //Else keep note unchanged
            return note;
        });

        //If The button was pressed yet no note was played means an incorrect button press
        const notesPlayed = updatedPlayerNotesK.filter(
            (note) => note.played,
        ).length;

        //If incorrect play a random note
        if (!notesPlayed) {
            //Seed is based on the current time
            playRandomNote(s.currentTime);
        }

        //If correct return the new state with a higher score and combo and multiplier if need be else
        //return the state with a lower score and combo and reset multiplier
        return notesPlayed > 0
            ? {
                  ...s,
                  score: s.score + notesPlayed * s.multiplier,
                  combo: s.combo + notesPlayed,
                  multiplier: 1 + Math.floor(s.combo / 10) * 0.2,
                  playerNotesK: updatedPlayerNotesK,
              }
            : { ...s, score: s.score - 1, combo: 0 };
    }
}

/** When the J key is pressed this action will edit the state of the game
 *
 * first it checks if the player is doing a valid click aka the note is hitable and not played
 * If so it plays the note and marks it as played and returns the new state with a higher score and combo and multiplier if need be
 * If not it returns the state with a lower score and combo and plays a random note
 *
 */
class jPressed implements Action {
    apply(s: State): State {
        //If the game is over return the state
        if (s.gameEnd) {
            return s;
        }
        //Map over all the notes and check if they are hitable and not played
        const updatedPlayerNotesJ = s.playerNotesJ.map((note) => {
            //Make sure there is a note and not an empty array
            if (note) {
                //Check if the note is hitable and not played
                if (note.hitable && !note.played) {
                    //Play Note
                    playNoteAtTime(
                        note,
                        SAMPLES as { [key: string]: Tone.Sampler },
                        Tone.now(),
                    );
                    // Mark all hitable notes as played
                    return { ...note, played: true };
                }
            }
            //Else keep note unchanged
            return note;
        });

        //If The button was pressed yet no note was played means an incorrect button press
        const notesPlayed = updatedPlayerNotesJ.filter(
            (note) => note.played,
        ).length;

        //If incorrect play a random note
        if (!notesPlayed) {
            //Seed is based on the current time
            playRandomNote(s.currentTime);
        }

        //If correct return the new state with a higher score and combo and multiplier if need be else
        //return the state with a lower score and combo and reset multiplier
        return notesPlayed > 0
            ? {
                  ...s,
                  score: s.score + notesPlayed * s.multiplier,
                  combo: s.combo + notesPlayed,
                  multiplier: 1 + Math.floor(s.combo / 10) * 0.2,
                  playerNotesJ: updatedPlayerNotesJ,
              }
            : { ...s, score: s.score - 1, combo: 0 };
    }
}

/** When the H key is pressed this action will edit the state of the game
 *
 * first it checks if the player is doing a valid click aka the note is hitable and not played
 * If so it plays the note and marks it as played and returns the new state with a higher score and combo and multiplier if need be
 * If not it returns the state with a lower score and combo and plays a random note
 *
 */
class hPressed implements Action {
    //Apply the action to the state
    apply(s: State): State {
        //If the game is over return the state
        if (s.gameEnd) {
            return s;
        }
        //Map over all the notes and check if they are hitable and not played
        const updatedPlayerNotesH = s.playerNotesH.map((note) => {
            //Make sure there is a note and not an empty array
            if (note) {
                //Check if the note is hitable and not played
                if (note.hitable && !note.played) {
                    //Play Note
                    playNoteAtTime(
                        note,
                        SAMPLES as { [key: string]: Tone.Sampler },
                        Tone.now(),
                    );
                    // Mark all hitable notes as played
                    return { ...note, played: true };
                }
            }
            //Else keep note unchanged
            return note;
        });

        //If The button was pressed yet no note was played means an incorrect button press
        const notesPlayed = updatedPlayerNotesH.filter(
            (note) => note.played,
        ).length;

        //If incorrect play a random note
        if (!notesPlayed) {
            //Seed is based on the current time
            playRandomNote(s.currentTime);
        }

        //If correct return the new state with a higher score and combo and multiplier if need be else
        //return the state with a lower score and combo and reset multiplier
        return notesPlayed > 0
            ? {
                  ...s,
                  score: s.score + notesPlayed * s.multiplier,
                  combo: s.combo + notesPlayed,
                  multiplier: 1 + Math.floor(s.combo / 10) * 0.2,
                  playerNotesH: updatedPlayerNotesH,
              }
            : { ...s, score: s.score - 1, combo: 0 };
    }
}

/**
 * This action will end the game and return the state with the gameEnd set to true
 */
class endGame implements Action {
    apply(s: State): State {
        return { ...s, gameEnd: true };
    }
}

/**
 * This action is the main action that does everything non render related in the game
 * It will increment the state time but 12 ms every time it is called,
 * Play all the Background notes that should have been played around that time
 * delete all played notes
 *
 * Check if the length of all note arrays is 0 and if so end the game
 *
 * Move all Player Notes down the screen and check if they are in a hitable spot
 *
 */
class TickAction implements Action {
    apply(s: State): State {
        //If the game is over return the state
        if (s.gameEnd) {
            return s;
        }

        //Check if all notes are played and if so end the game
        if (
            s.notes.length - 1 == 0 &&
            s.playerNotesH.length == 0 &&
            s.playerNotesJ.length == 0 &&
            s.playerNotesK.length == 0 &&
            s.playerNotesL.length == 0
        ) {
            return { ...s, gameEnd: true };
        }

        //Map over all background Notes and play them if the current time > start time and set them to played
        const updatedNotes = s.notes.map((note) => {
            if (note.start <= s.currentTime && !note.played) {
                playNoteAtTime(
                    note,
                    SAMPLES as { [key: string]: Tone.Sampler },
                    Tone.now(),
                );
                return { ...note, played: true };
            }
            return note;
        });

        //Map over all player notes and move them down the screen and check if they are hitable
        //it check if the start time of notes that are gonna play in 3 seconds or less as to give
        //the user time for the note to fall down and show the animation
        //Else move the note down the screen the number 1.4 comes from the fact that
        //there are 250 ticks in 3 seconds and the screen is 350 pixels high so 350/250 = 1.4

        const updatedPlayerNotesH = s.playerNotesH.map((note) => {
            if (note.start <= s.currentTime + 3 && !note.played) {
                //make the note hitable if it is in the hitable zone
                const hitable = note.y >= Constants.PLAYABLE_TIME;
                if (note.y >= Constants.DEATH_TIME) {
                    //If the note is in the death zone mark it as played and move it down the screen
                    return { ...note, played: true, y: note.y + 1.4 };
                }
                return { ...note, y: note.y + 1.4, hitable: hitable };
            }
            return note;
        });

        const updatedPlayerNotesJ = s.playerNotesJ.map((note) => {
            if (note.start <= s.currentTime + 3 && !note.played) {
                //make the note hitable if it is in the hitable zone
                const hitable = note.y >= Constants.PLAYABLE_TIME;
                if (note.y >= Constants.DEATH_TIME) {
                    //If the note is in the death zone mark it as played and move it down the screen
                    return { ...note, played: true, y: note.y + 1.4 };
                }
                return { ...note, y: note.y + 1.4, hitable: hitable };
            }
            return note;
        });

        const updatedPlayerNotesK = s.playerNotesK.map((note) => {
            if (note.start <= s.currentTime + 3 && !note.played) {
                //make the note hitable if it is in the hitable zone
                const hitable = note.y >= Constants.PLAYABLE_TIME;
                if (note.y >= Constants.DEATH_TIME) {
                    //If the note is in the death zone mark it as played and move it down the screen
                    return { ...note, played: true, y: note.y + 1.4 };
                }
                return { ...note, y: note.y + 1.4, hitable: hitable };
            }
            return note;
        });

        const updatedPlayerNotesL = s.playerNotesL.map((note) => {
            if (note.start <= s.currentTime + 3 && !note.played) {
                //make the note hitable if it is in the hitable zone
                const hitable = note.y >= Constants.PLAYABLE_TIME;
                if (note.y >= Constants.DEATH_TIME) {
                    //If the note is in the death zone mark it as played and move it down the screen
                    return { ...note, played: true, y: note.y + 1.4 };
                }
                return { ...note, y: note.y + 1.4, hitable: hitable };
            }
            return note;
        });

        //Filter all notes that reached the death zone without being played so we can subtract there score in the return statement
        const highNotes = [
            ...updatedPlayerNotesH.filter(
                (note) => note.y >= Constants.DEATH_TIME + 1,
            ),
            ...updatedPlayerNotesJ.filter(
                (note) => note.y >= Constants.DEATH_TIME + 1,
            ),
            ...updatedPlayerNotesK.filter(
                (note) => note.y >= Constants.DEATH_TIME + 1,
            ),
            ...updatedPlayerNotesL.filter(
                (note) => note.y >= Constants.DEATH_TIME + 1,
            ),
        ];

        //Return new state with all the played notes removed from the array
        //current time incremented by 12 ms
        //score decremented by the number of notes that reached the death zone
        //combo resets if there are notes that reached the death zone
        //multiplier resets if there are notes that reached the death zone
        return {
            ...s,
            currentTime: s.currentTime + Constants.TICK_RATE_MS / 1000,
            notes: updatedNotes.filter((note) => !note.played),
            playerNotesH: updatedPlayerNotesH.filter((note) => !note.played),
            playerNotesJ: updatedPlayerNotesJ.filter((note) => !note.played),
            playerNotesK: updatedPlayerNotesK.filter((note) => !note.played),
            playerNotesL: updatedPlayerNotesL.filter((note) => !note.played),
            score: s.score - highNotes.length,
            combo: highNotes.length > 0 ? 0 : s.combo,
            multiplier: highNotes.length > 0 ? 1 : s.multiplier,
        };
    }
}

/*
 * This action will reset the game to the initial state (in development as clicking it will work but the game will not start again)
 */
class reset implements Action {
    apply(s: State): State {
        return {
            ...s,
            gameEnd: false,
            score: 0,
            combo: 0,
            multiplier: 1,
            notes: [],
            playerNotesH: [],
            playerNotesJ: [],
            playerNotesK: [],
            playerNotesL: [],
            currentTime: 0,
        };
    }
}

/**
 * This function will parse the CSV file and return an array of NoteData
 *
 * @param csv The CSV file that will be parsed
 * @returns An array of NoteData
 */
function parseCSV(csv: String): NoteData[] {
    //Split the CSV file by line
    const lines = csv.split("\n");

    //Map over all lines and split them by the comma
    const notes: NoteData[] = lines.slice(1).map((line) => {
        const values = line.split(",");

        return {
            //The x value is calculated by the pitch % 4 + 1 * 20, % 4 to split into a 0-3 range
            //+ 1 to make it 1-4 and * 20 to make it 20, 40, 60, 80
            x: ((parseFloat(values[3]) % 4) + 1) * 20,
            y: 0,
            userPlayed: values[0] == "True",
            instrumentName: values[1],
            velocity: parseFloat(values[2]),
            pitch: parseFloat(values[3]),
            //+3 to insure there is time for the player to press the button no matter what csv file is given
            start: parseFloat(values[4]) + 3,
            end: parseFloat(values[5]) + 3,
            played: false,
            hitable: false,
        } as NoteData;
    });

    return notes;
}

/**
 * This function will play a note at a certain time
 *
 * @param note The note that will be played
 * @param SAMPLES The samples that will be used to play the note
 * @param time The time the note will be played
 */
function playNoteAtTime(
    note: NoteData,
    SAMPLES: { [key: string]: Tone.Sampler },
    time: number,
) {
    //get the instrument from the samples
    const instrument = SAMPLES[note.instrumentName];

    //If the instrument is not null
    if (instrument) {
        //Play the note at the time it should be played which is always Tone.now()
        instrument.triggerAttackRelease(
            Tone.Frequency(note.pitch, "midi").toNote(),
            note.end - note.start,
            time,
            note.velocity / 127,
        );
    }
}

/**
 * This function will add a note to the SVG canvas
 *
 * @param note The note that will be added to the canvas
 * @param svg The canvas the note will be added to
 */
function addSVGNote(note: NoteData, svg: SVGGraphicsElement) {
    //get the color od the note
    const color = fillingColor(note);

    //create the note render
    const renderNote = createSvgElement(svg.namespaceURI, "circle", {
        r: `${Note.RADIUS}`,
        cx: note.x.toString() + "%",
        cy: note.y.toString(),
        style: "fill:url(#" + color + "Gradient)",
        class: "shadow",
    });
    //append the note render
    svg.appendChild(renderNote);
}

/**
 * This function will return the color of the note based on the pitch
 *
 * @param note The note that will be used to get the color
 */
function fillingColor(note: NoteData) {
    //Using the same formula up we get the pitch of the note and return the color
    const x = ((note.pitch % 4) + 1) * 20;
    if (x == 20) {
        return "green";
    } else if (x == 40) {
        return "red";
    } else if (x == 60) {
        return "blue";
    } else {
        return "yellow";
    }
}

/**
 * This function will filter all notes that are at a certain x value
 *
 * @param notes The notes that will be filtered
 * @param x The x value that will be used to filter the notes
 */
function filterNotes(notes: NoteData[], x: number) {
    return notes.filter((note) => note.x == x && note.userPlayed);
}

/**
 * This is the RNG Class taken mostly from the workshop 4
 * hashes the numbers with a seed to give us a random number
 */
abstract class RNG {
    // LCG using GCC's constants
    private static m = 0x80000000; // 2**31
    private static a = 1103515245;
    private static c = 12345;

    /**
     * Call `hash` repeatedly to generate the sequence of hashes.
     * @param seed
     * @returns a hash of the seed
     */
    public static hash = (seed: number) => (RNG.a * seed + RNG.c) % RNG.m;

    /**
     * Takes hash value and scales it to the range [-1, 1]
     */
    public static scale = (hash: number) => (2 * hash) / (RNG.m - 1) - 1;

    /**
     * Generates a random number between min and max
     * @param seed
     * @param min
     * @param max
     * @returns a random number between min and max
     */
    public static randomInt(seed: number, min: number, max: number) {
        const hash = RNG.hash(seed);

        const scale = hash / RNG.m - 1;

        return Math.floor(min + scale * (max - min));
    }
}

/**
 *
 * This function will play a random note
 * @param seed The seed that will be used to generate the random note
 * @returns void
 *
 * */
function playRandomNote(seed: number) {
    //Make a randome musical note
    const pitch = RNG.randomInt(seed, 48, 72);
    const velocity = RNG.randomInt(seed, 50, 100);
    const time = Tone.now();
    const duration = 0.5;

    //get a random instrument
    const instrument =
        SAMPLES[Constants.INSTRUMENTS[RNG.randomInt(seed, 1, 18) * -1]];

    //Play Note
    instrument.triggerAttackRelease(
        Tone.Frequency(pitch, "midi").toNote(),
        duration,
        time,
        velocity / 127,
    );
}

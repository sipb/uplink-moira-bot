import { 
    MatrixClient,
    SimpleFsStorageProvider,
    AutojoinRoomsMixin,
} from 'matrix-bot-sdk';
import fs from 'fs';
import { Moira } from './moira.js';
import config from './config.js';

const moira = await Moira.initialize('personal.key', 'personal.cert');

const accessToken = fs.readFileSync('token.txt', 'utf-8');

/// https://turt2live.github.io/matrix-bot-sdk/tutorial-bot.html

// In order to make sure the bot doesn't lose its state between restarts, we'll give it a place to cache
// any information it needs to. You can implement your own storage provider if you like, but a JSON file
// will work fine for this example.
const storage = new SimpleFsStorageProvider("storage.json");

const client = new MatrixClient(config.homeserver, accessToken, storage);
AutojoinRoomsMixin.setupOnClient(client);

// Before we start the bot, register our command handler
client.on("room.message", handleCommand);

// Now that everything is set up, start the bot. This will start the sync loop and run until killed.
client.start().then(() => console.log("Bot started!"));

function extractLocalpart(username: string) {
    return username.match(/@(.+):.+/)![1];
}

// This is the command handler we registered a few lines up
async function handleCommand(roomId: string, event: any) {
    // Don't handle unhelpful events (ones that aren't text messages, are redacted, or sent by us)
    if (event['content']?.['msgtype'] !== 'm.text') return;
    if (event['sender'] === await client.getUserId()) return;
    
    const body = event['content']['body'];
    const username = extractLocalpart(event['sender']);
    if (body.startsWith("!hello")) {
        // Now that we've passed all the checks, we can actually act upon the command
        await client.replyNotice(roomId, event, "Hello world!");
    } else if (body.startsWith("!myclasses")) {
        const classes = await moira.getUserClasses(username);
        const currentClasses = classes.filter((name) => name.startsWith('canvas-2023'));
        await client.replyNotice(roomId, event, `${currentClasses.join('\n')}`);
    } else if (body.startsWith("!myname")) {
        await client.replyNotice(roomId, event, await moira.getUserName(username));
    }
}

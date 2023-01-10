import { 
    MatrixClient,
    SimpleFsStorageProvider,
    AutojoinRoomsMixin,
} from 'matrix-bot-sdk';
import fs from 'fs';
import config from './config.js';

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

// This is the command handler we registered a few lines up
async function handleCommand(roomId: string, event: any) {
    // Don't handle unhelpful events (ones that aren't text messages, are redacted, or sent by us)
    if (event['content']?.['msgtype'] !== 'm.text') return;
    if (event['sender'] === await client.getUserId()) return;
    
    // Check to ensure that the `!hello` command is being run
    const body = event['content']['body'];
    if (!body?.startsWith("!hello")) return;
    
    // Now that we've passed all the checks, we can actually act upon the command
    await client.replyNotice(roomId, event, "Hello world!");
}

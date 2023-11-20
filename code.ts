figma.showUI(__html__, { width: 400, height: 400 });
figma.ui.onmessage = (msg) => {
    if (msg.type === 'create-cards') {
        processRequest(msg.request);
    }
};

async function processRequest(request: string) {
    const json = JSON.parse(request);

    if (json.type === 'spotify') {
        await getSpotifyTracks(json.url);
    } else if (json.type === 'custom') {
        await createCards([
            { title: json.title, artist: json.artist, coverUrl: undefined }
        ]);
    } else if (json.type === 'soundcloud') {
        const track = await getSoundcloudTrack(json.url);
    }
};

async function createCards(tracks: [{ title: string, artist: string, coverUrl: string | undefined }]) {
    await figma.loadFontAsync({ family: "Inter", style: "Medium" })

    const nodes: SceneNode[] = [];

    let i = 0;
    for (const { title, artist, coverUrl } of tracks) {
        const card = await createCard(title, artist, coverUrl);
        card.x = 0;
        card.y = i++ * 320;
        nodes.push(card);
    }

    figma.currentPage.selection = nodes;
    figma.viewport.scrollAndZoomIntoView(nodes);
}

async function createCard(title: string, artist: string, cover_url: string | undefined) {
    // Frame
    const card = figma.createFrame();
    card.name = title;
    card.resize(1200, 300);
    card.fills = [{ type: 'SOLID', color: { r: 0.07, g: 0.07, b: 0.07 } }];
    card.cornerRadius = 20;

    // Coverart
    const coverNode = figma.createRectangle();
    coverNode.resize(260, 260);
    coverNode.x = 20;
    coverNode.y = 20;
    coverNode.cornerRadius = 20;
    coverNode.fills = [{ type: 'SOLID', color: { r: 0.157, g: 0.157, b: 0.157 } }];
    coverNode.locked = true;
    card.appendChild(coverNode);
    const icon = figma.createNodeFromSvg('<svg viewBox="0 0 16 16"><path fill="white" d="M10 2v9.5a2.75 2.75 0 1 1-2.75-2.75H8.5V2H10zm-1.5 8.25H7.25A1.25 1.25 0 1 0 8.5 11.5v-1.25z"></path></svg>');
    icon.resize(120, 120);
    icon.x = 80
    icon.y = 80
    icon.locked = true;
    if (cover_url === undefined) {
        card.appendChild(icon);
    } else {
        try {
            const cover = await figma.createImageAsync(cover_url);
            coverNode.fills = [{ type: 'IMAGE', imageHash: cover.hash, scaleMode: 'FILL' }];
            icon.remove();
        } catch (e) {
            card.appendChild(icon);
        }
    }

    // Title
    const titleText = figma.createText();
    titleText.fontName = { family: "Inter", style: "Medium" };
    titleText.characters = title;
    titleText.fontSize = 48;
    titleText.x = 300;
    titleText.y = 102;
    titleText.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
    titleText.locked = true;
    card.appendChild(titleText);

    // Artist
    const artistText = figma.createText();
    artistText.fontName = { family: "Inter", style: "Medium" };
    artistText.characters = artist;
    artistText.fontSize = 32;
    artistText.x = 300;
    artistText.y = 160;
    artistText.fills = [{ type: 'SOLID', color: { r: 0.596, g: 0.596, b: 0.596 } }];
    artistText.locked = true;
    card.appendChild(artistText);

    // Cap
    const cap = figma.createRectangle();
    cap.resize(20, 260);
    cap.x = 1180;
    cap.y = 20;
    cap.fills = [{ type: 'SOLID', color: { r: 0.07, g: 0.07, b: 0.07 } }];
    cap.locked = true;
    card.appendChild(cap);

    return card;
}

async function getSpotifyTracks(url: string) {
    const clientId = "";
    const clientSecret = "";

    // Validate url
    const regex = /https:\/\/open\.spotify\.com\/(playlist|album|track)\/([a-zA-Z0-9]+)/;
    const match = url.match(regex);
    if (match === null) {
        figma.notify("Invalid Spotify URL");
        return;
    }

    const tokenResponse = await fetch("https://accounts.spotify.com/api/token", {
        method: 'POST',
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: `grant_type=client_credentials&client_id=${clientId}&client_secret=${clientSecret}`,
    });

    const tokenJson = await tokenResponse.json();
    const token = tokenJson.access_token;

    let tracks: [{ title: string, artist: string, coverUrl: string | undefined }] | [] = [];
    
    // Check if url contains "playlist"
    if (url.includes("playlist")) {
        const response = await fetch(`https://api.spotify.com/v1/playlists/${match[2]}/tracks`, {
            method: 'GET',
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        const json = await response.json();
        tracks = json.items.map((track: any) => {
            const coverUrl = track.track.album.images.length > 0 ? track.track.album.images[0].url : undefined;

            return {
                title: track.track.name,
                artist: track.track.artists.map((artist: any) => artist.name).join(', '),
                coverUrl
            }
        });
    } else if (url.includes("album")) {
        const response = await fetch(`https://api.spotify.com/v1/albums/${match[2]}`, {
            method: 'GET',
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        const json = await response.json();
        const coverUrl = json.images.length > 0 ? json.images[0].url : undefined;
        tracks = json.tracks.items.map((track: any) => {
            return {
                title: track.name,
                artist: track.artists.map((artist: any) => artist.name).join(', '),
                coverUrl
            }
        });
    } else if (url.includes("track")) {
        const response = await fetch(`https://api.spotify.com/v1/tracks/${match[2]}`, {
            method: 'GET',
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        const json = await response.json();

        tracks = [{ title: json.name, artist: json.artists.map((artist: any) => artist.name).join(', '), coverUrl: json.album.images[0].url }];
    }

    if (tracks.length === 0) {
        figma.notify("No tracks found");
        return;
    }

    createCards(tracks);
}

async function getSoundcloudTrack(url: string) {
    // Validate url
    const regex = /https:\/\/soundcloud\.com\/([a-zA-Z0-9-]+)\/([a-zA-Z0-9-]+)/;
    const match = url.match(regex);
    if (match === null) {
        figma.notify("Invalid Soundcloud URL");
        return;
    }

    const response = await fetch(`https://soundcloud.com/oembed?url=${url}&format=json`);
    const json = await response.json();

    await createCards([{ title: json.title, artist: json.author_name, coverUrl: json.thumbnail_url }]);
}

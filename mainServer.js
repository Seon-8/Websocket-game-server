const webSocket = require("ws")

let clients = new Map();
let rooms = new Map();

// let serverSlots = [1,2,3,4];

let serverLimit = 4;

const PORT = process.env.PORT || 8080;

const wsServer = new webSocket.Server({port:PORT},()=>{
    console.log("Server started...")
})

function broadcast(roomId,messageObject,sourceId) {
    const messageString = JSON.stringify(messageObject);

    const room = rooms.get(roomId)

    if(!room)return

    room.players.forEach((clientData,clientSocket) => {
            if(clientData.id !== sourceId)clientSocket.send(messageString);
    });
}

function receiveAll(sourceSocket){
    const roomId = clients.get(sourceSocket).roomId
    const room = rooms.get(roomId)

    if(!room)return
    const players = room.players
    const player = players.get(sourceSocket)
    const sourceId = player.id

    players.forEach((clientData,clientSocket) => {
        if(sourceId !== clientData.id)
        {
            const messageObject = {
                type: "newPlayer",
                playerId: clientData.id,
                roomId:roomId
            }
            const messageString = JSON.stringify(messageObject);
            sourceSocket.send(messageString)
        }
    });

}

function makeid(length) {
    var result           = '';
    var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    var charactersLength = characters.length;
    for ( var i = 0; i < length; i++ ) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }

    if (rooms.has(result)) {
        return makeid(length);
    }

    return result;
}

function createRoom(playerSocket)
{
    let roomid = makeid(4)

    rooms.set(roomid,{
        players: new Map(),
        slots: [1,2]
    })

    console.log(`RoomID: ${roomid}...`)

    joinRoom(roomid,playerSocket)
}

function joinRoom(roomIndex,playerSocket)
{
    const room = rooms.get(roomIndex)
    const players = room.players

    const playerNum = room.slots.shift()

    players.set(playerSocket,{
        id: playerNum
    })

    clients.get(playerSocket).roomId = roomIndex

    const message = {
        type: "assignId",
        playerId: playerNum,
        roomId: roomIndex
    }

    playerSocket.send(`${JSON.stringify(message)}`)
    console.log(`Player ${playerNum} assigned`)

    const remoteMessage = {
         type: "newPlayer",
         playerId: playerNum,
         roomId: roomIndex
    }
    
    broadcast(roomIndex,remoteMessage,playerNum)
    receiveAll(playerSocket);


}


wsServer.on("connection", socket=>{


    if(serverLimit===0)
    {
        const fullMessage = {
            type: "serverFull",
            roomIsFull: true
        }
        socket.send(`${JSON.stringify(fullMessage)}`)
        socket.close()
        return
    }
    else{
        const fullMessage = {
            type: "serverFull",
            roomIsFull: false
        }
        socket.send(`${JSON.stringify(fullMessage)}`)
    }
    
    serverLimit -=1

    clients.set(socket,{
        roomId: ""
    })

    console.log(`Connection opened by a Player`)

    


    socket.on("message",message=>{
        let roomId = clients.get(socket).roomId
        let room = rooms.get(roomId)
        let players;
        let player;

        if(room)
        {
            players = room.players
            player = players.get(socket)
            if(!player)return;
        }

        const data = JSON.parse(message)

        //Move
        if(data.type == "move")
        {
            const moveMessage = {
                type: "move",
                playerId: player.id,
                x:data.x,
                y:data.y,
            }

            broadcast(roomId,moveMessage,player.id)
        }

        //Jump
        if(data.type == "jump")
        {
            const jumpMessage = {
                type: "jump",
                playerId:player.id,
                jumpPressed:data.jumpPressed,
                jumpReleased:data.jumpReleased,
            }

            broadcast(roomId,jumpMessage,player.id)
        }

        //AbsolutePosition
        if(data.type == "pos")
        {
            const posMessage = {
                type:"pos",
                playerId:player.id,
                absX:data.absX,
                absY:data.absY,
            }

            broadcast(roomId,posMessage,player.id)

        }

        //Freeze
        if(data.type == "freeze")
        {
            const freezeMessage = {
                type:"freeze",
                playerId:player.id,
                isFrozen:data.isFrozen,
            }

            broadcast(roomId,freezeMessage,player.id)

        }

        //Teleport
        if(data.type == "teleport")
        {
            const teleportMessage = {
                type:"teleport",
                playerId:player.id,
                telX:data.telX,
                telY:data.telY,
            }

            broadcast(roomId,teleportMessage,player.id)

        }

        //CreateRoom
        if(data.type == "createRoom")
        {
            createRoom(socket)
        }

        //JoinRoom
        if(data.type == "joinRoom")
        {
            if(!rooms.has(data.roomId) || rooms.get(data.roomId).slots.length==0)
            {
                console.log("Room Unavailable")
                const noRoomMessage = {
                    type:"roomAvailable",
                    roomIsFull: true
                }
                socket.send(`${JSON.stringify(noRoomMessage)}`)
            }
            else{
                const noRoomMessage = {
                    type:"roomAvailable",
                    roomIsFull: false
                }
                socket.send(`${JSON.stringify(noRoomMessage)}`)
                joinRoom(data.roomId,socket)
            }
        }

        //StartGame
        if(data.type == "startGame")
        {
            const startMessage = 
            {
                type:"startGame",
            }

            broadcast(roomId,startMessage,player.id)
        }

        //LevelComplete
        if(data.type == "level")
        {
            const levelMessage = 
            {
                type:"level",
            }

            broadcast(roomId,levelMessage,player.id)
        }

        //PlayAgain
        if(data.type == "playAgain")
        {
            const newMessage = 
            {
                type:"playAgain",
            }

            broadcast(roomId,newMessage,player.id)
        }

        //ExitGame
        if(data.type == "exitGame")
        {
            const newMessage = 
            {
                type:"exitGame",
            }

            broadcast(roomId,newMessage,player.id)
        }
    })

    socket.on("close",()=>{
        let roomId = clients.get(socket).roomId;
        let room = rooms.get(roomId)

        if(roomId != "")
        {
            let players = room.players
            let player = players.get(socket)
    
            if(player === null)return;

            room.slots.push(player.id)
            room.slots.sort((a,b)=>a-b)

            const remoteCloseMessage = {
                type:"remoteClose",
                playerId : player.id
            }
            broadcast(roomId,remoteCloseMessage,player.id)

            players.delete(socket)
            console.log(`Player ${player.id} left Room`)

            if(players.size <=0)
            {
                rooms.delete(roomId)
                console.log(`Empty Room ${roomId} deleted`)
            }
        }
            
        
        console.log(`Connection closed by a Player`)
        
        clients.delete(socket)

        serverLimit+=1

    })
})

wsServer.on("listening",()=>{
    console.log("Server is listening...")
})


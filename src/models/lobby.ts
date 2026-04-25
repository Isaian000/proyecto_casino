import { Schema, model, Document, Types } from 'mongoose';

export type LobbyGame = 'blackjack' | 'roulette';
export type LobbyStatus = 'open' | 'in_progress' | 'closed';

export interface ILobby extends Document {
    code: string;
    game: LobbyGame;
    status: LobbyStatus;
    minBet: number;
    maxBet: number;
    maxPlayers: number;
    players: Types.ObjectId[];
    host?: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const lobbySchema = new Schema<ILobby>(
    {
        code: { type: String, required: true, unique: true, index: true },
        game: {
            type: String,
            enum: ['blackjack', 'roulette'],
            required: true,
        },
        status: {
            type: String,
            enum: ['open', 'in_progress', 'closed'],
            default: 'open',
        },
        minBet: { type: Number, default: 10, min: 0 },
        maxBet: { type: Number, default: 1000, min: 0 },
        maxPlayers: { type: Number, default: 4, min: 1 },
        players: [{ type: Schema.Types.ObjectId, ref: 'User' }],
        host: { type: Schema.Types.ObjectId, ref: 'User' },
    },
    { timestamps: true }
);

export default model<ILobby>('Lobby', lobbySchema);

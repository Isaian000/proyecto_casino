import { Schema, model, Document, Types } from 'mongoose';

export type FriendshipStatus = 'pending' | 'accepted' | 'blocked';

export interface IFriendship extends Document {
    requester: Types.ObjectId;
    recipient: Types.ObjectId;
    status: FriendshipStatus;
    createdAt: Date;
    updatedAt: Date;
}

const friendshipSchema = new Schema<IFriendship>(
    {
        requester: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        recipient: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        status: {
            type: String,
            enum: ['pending', 'accepted', 'blocked'],
            default: 'pending',
        },
    },
    { timestamps: true }
);

// Garantiza una sola relacion entre dos usuarios sin importar el orden
friendshipSchema.index(
    { requester: 1, recipient: 1 },
    { unique: true }
);

export default model<IFriendship>('Friendship', friendshipSchema);

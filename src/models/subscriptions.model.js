import mongoose, { Schema } from "mongoose";

const subscriptionSchema = new mongoose.Schema(
	{
		subscriber: {
			type: Schema.Types.ObjectId,
			ref: "User", // The one who is subscribing
		},
		channel: {
			type: Schema.Types.ObjectId,
			ref: "User", // The one who got subscribed
		},
	},
	{ timestamps: true }
);

export const Subscriptions = mongoose.model(
	"Subscriptions",
	subscriptionSchema
);

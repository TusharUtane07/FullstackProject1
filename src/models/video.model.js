import mongoose, { Schema, model } from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const videoSchema = new Schema(
	{
		videoFile: {
			type: String,
			required: true,
		},
		thumbnail: {
			type: String,
			required: true,
		},
		title: {
			type: String,
			required: true,
		},
		description: {
			type: String,
			required: true,
		},
		duration: {
			type: Number,
			required: true,
		},
		views: {
			type: Number,
			default: 0,
			required: true,
		},
		isPublished: {
			type: Boolean,
			default: true,
			required: true,
		},
		owner: {
			type: Schema.Types.ObjectId,
			ref: "User",
		},
	},
	{ timestamps: true }
);

videoSchema.plugin(mongooseAggregatePaginate);
// Plugins are used to plug some functionalties

export const Video = model("Video", videoSchema);

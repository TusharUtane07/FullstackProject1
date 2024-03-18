import { asyncHandler } from "../utils/AsyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadToCloudinary } from "../utils/Cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const registerUser = asyncHandler(async (req, res) => {
	// Getting data from client side
	const { fullname, username, email, password } = req.body;
	console.log(fullname, username, email, password);

	// Checking whether data is present or not, if not throwing error
	if (
		[fullname, username, email, password].some(
			(fields) => fields?.trim() === ""
		)
	) {
		throw new ApiError(400, "All fields are required");
	}

	// Checking for existing user
	const existedUser = await User.findOne({
		$or: [{ username }, { email }],
	});

	// If existing user found, throwing error
	if (existedUser) {
		throw new ApiError(
			409,
			"User with similar username or email already existed"
		);
	}

	// Getting the path or files / images
	const avatarLocalPath = req.files?.avatar[0]?.path;

	// Checks for coverImage
	let coverImageLocalPath;
	if (
		req.files &&
		Array.isArray(req.files.coverImage) &&
		req.files.coverImage.length > 0
	) {
		coverImageLocalPath = req.files.coverImage[0].path;
	}

	// Avatar image is compulsory so if not found throwing error
	if (!avatarLocalPath) {
		throw new ApiError(400, "Avatar image is required");
	}

	// Uploading on cloudinary
	const avatar = await uploadToCloudinary(avatarLocalPath);
	const coverImage = await uploadToCloudinary(coverImageLocalPath);

	// Avatar image is compulsory so if not found throwing error
	if (!avatarLocalPath) {
		throw new ApiError(400, "Avatar image is required");
	}

	// Adding all the data-entries to Database
	const user = await User.create({
		fullname,
		avatar: avatar.url,
		coverImage: coverImage?.url || "",
		email,
		password,
		username: username.toLowerCase(),
	});

	// Getting data for validation
	const createdUser = await User.findById(user._id).select(
		"-password -refreshToken"
	);

	// Checking data is there or not if not throwing the error
	if (!createdUser) {
		throw new ApiError(500, "Something went wrong while user registration");
	}

	// At the end sending the api response
	return res
		.status(201)
		.json(new ApiResponse(200, createdUser, "User registered successfully"));
});

export { registerUser };

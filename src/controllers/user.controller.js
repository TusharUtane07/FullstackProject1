import { asyncHandler } from "../utils/AsyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadToCloudinary } from "../utils/Cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

// creating method for generating access and refresh tokens
const generateAccessAndRefreshTokens = async (userId) => {
	try {
		// finding user with id
		const user = await User.findById(userId);
		// running function for generating access token that is created in user model
		const accessToken = user.generateAccessToken();
		// running function for generating refresh token that is created in user model
		const refreshToken = user.generateRefreshToken();

		// saving refresh token in database
		user.refreshToken = refreshToken;
		await user.save({ validateBeforeSave: false });

		// returning both access and refresh token for after use
		return { accessToken, refreshToken };
	} catch (error) {
		throw new ApiError(
			500,
			"Something went wrong, while generating refresh and access tokens"
		);
	}
};

const registerUser = asyncHandler(async (req, res) => {
	// Getting data from client side
	const { fullname, username, email, password } = req.body;

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

// writing code for logging user in
const loginUser = asyncHandler(async (req, res) => {
	// Getting user input
	const { username, email, password } = req.body;

	// checking email or username anyone present or not, if not throw error
	if (!email && !username) {
		throw new ApiError(400, "Email or Username is required");
	}

	// checking in database if this username or email present or not
	const user = await User.findOne({
		$or: [{ username }, { email }],
	});

	// throwing error if such user is not present
	if (!user) {
		throw new ApiError(404, "User does not exists, Register first");
	}

	// checking password validation, throwing error if not
	const isPasswordValid = await user.isPasswordCorrect(password);
	if (!isPasswordValid) {
		throw new ApiError(402, "Password is not correct");
	}

	// calling function for generating and saving access and refresh token
	const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
		user._id
	);

	// selecting fields to send user without password and refresh token
	const loggedInUser = await User.findById(user._id).select(
		"-password -refreshToken"
	);

	// sending data with cookies to user, we neet to create some options
	const options = {
		// below properties are used to secure our cookies, i.e this cookies can not be modified on frontend, it can be modified by server
		httpOnly: true,
		secure: true,
	};

	// sending the response
	return res
		.status(200)
		.cookie("AccessToken", accessToken, options)
		.cookie("RefreshToken", refreshToken, options)
		.json(
			new ApiResponse(
				200,
				{
					user: loggedInUser,
					accessToken,
					refreshToken,
				},
				"User logged in Successfully"
			)
		);
});

// writing code for logout user in
const logoutUser = asyncHandler(async (req, res) => {
	await User.findByIdAndUpdate(
		req.user._id,
		{
			$set: {
				refreshToken: undefined,
			},
		},
		{
			new: true,
		}
	);
	const options = {
		// below properties are used to secure our cookies, i.e this cookies can not be modified on frontend, it can be modified by server
		httpOnly: true,
		secure: true,
	};

	// sending proper response that user is logged out and also sending information like status code etc
	return res
		.status(200)
		.clearCookie("AccessToken", options)
		.clearCookie("RefreshToken", options)
		.json(new ApiResponse(200, {}, "User logged out successfully"));
});

// checking refreshtoken for authentication time refreshment of user
const refreshAccessToken = asyncHandler(async (req, res) => {
	try {
		// getting refresh token from cookies that we saved
		const incomingRefreshToken =
			req.cookies?.RefreshToken || req.body?.RefreshToken;

		// if not present throw error
		if (!incomingRefreshToken) {
			throw new ApiError(402, "Unauthorized request");
		}

		// verifying the refreshtoken as did before
		const decodedToken = jwt.verify(
			incomingRefreshToken,
			process.env.REFRESH_TOKEN_SECRET
		);

		// if we have id then store it in user, data is send by the jwt token
		const user = await User.findById(decodedToken?._id);

		// if not present throw error
		if (!user) {
			throw new ApiError(401, "Invalid refresh token");
		}
		// matching the incoming and already added token
		if (incomingRefreshToken !== user?.refreshToken) {
			throw new ApiError(401, "Refresh token is expired or used");
		}

		const options = {
			httpOnly: true,
			secure: true,
		};

		const { accessToken, newRefreshToken } =
			await generateAccessAndRefreshTokens(user._id);

		return res
			.status(200)
			.cookie("AccessToken", accessToken, options)
			.cookie("RefreshToken", newRefreshToken, options)
			.json(
				new ApiResponse(
					200,
					{ accessToken, refreshToken: newRefreshToken },
					"Access token refreshed successfully"
				)
			);
	} catch (error) {
		throw new ApiError(400, "Invalid Refresh Token");
	}
});

// writing functionality to changing current password
const changingCurrentPassword = asyncHandler(async (req, res) => {
	const { oldPassword, newPassword } = req.body;

	const user = await User.findById(req.user?._id);

	const isPasswordCorrect = await User.isPasswordCorrect(oldPassword);

	if (!isPasswordCorrect) {
		throw new ApiError(400, "Invalid Password");
	}

	user.password = newPassword;
	await user.save({ validateBeforeSave: false });

	return res
		.status(200)
		.json(new ApiResponse(200, {}, "Password change successfully"));
});

// getting current user
const getCurrentUser = asyncHandler(async (req, res) => {
	return res
		.status(200)
		.json(new ApiResponse(200, req.user, "Current User Fetched Successfully"));
});

// updating user account details
const updateAccountDetails = asyncHandler(async (req, res) => {
	const { fullname, email } = req.body;

	if (!fullname || !email) {
		throw new ApiError(400, "All fields are required");
	}
	// did same as aboe saed updated user data and also not to get password as abaoe select method
	const user = User.findByIdAndUpdate(
		req.user?._id,
		{
			$set: {
				fullname,
				email,
			},
		},
		{ new: true }
	).select("-password");

	return res
		.status(200)
		.json(new ApiResponse(200, user, "Account details updated successfully"));
});

// updating user's avatar
const updateUserAvatar = asyncHandler(async (req, res) => {
	const avatarLocalPath = req.file?.path;

	if (!avatarLocalPath) {
		throw new ApiError(200, "File not found");
	}

	const avatar = await uploadToCloudinary(avatarLocalPath);

	if (!avatar.url) {
		throw new ApiError(400, "Error while uploading avatar");
	}

	const user = await User.findByIdAndUpdate(
		req.user?._id,
		{
			$set: {
				avatar: avatar.url,
			},
		},
		{ new: true }
	).select("-password");

	return res
		.status(200)
		.json(new ApiResponse(200, user, "Avatar Image updated successfully"));
});

// updating user's coverImage
const updateUserCoverImage = asyncHandler(async (req, res) => {
	const coverImageLocalPath = req.file?.path;

	if (!coverImageLocalPath) {
		throw new ApiError(200, "File not found");
	}

	const coverImage = await uploadToCloudinary(coverImageLocalPath);

	if (!coverImage.url) {
		throw new ApiError(400, "Error while uploading Cover Image");
	}

	const user = await User.findByIdAndUpdate(
		req.user?._id,
		{
			$set: {
				coverImage: coverImage.url,
			},
		},
		{ new: true }
	).select("-password");

	return res
		.status(200)
		.json(new ApiResponse(200, user, "Cover Image updated successfully"));
});

export {
	registerUser,
	loginUser,
	logoutUser,
	refreshAccessToken,
	changingCurrentPassword,
	updateAccountDetails,
	getCurrentUser,
	updateUserCoverImage,
	updateUserAvatar,
};

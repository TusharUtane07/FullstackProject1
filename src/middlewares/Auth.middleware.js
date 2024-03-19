import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/AsyncHandler.js";
import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";

// if anything of the below middleware is not in use in the whole code we can replace that by _, for eg. below code is not res anywhere in the code so we replaced that with _
export const verifyJWT = asyncHandler(async (req, _, next) => {
	try {
		// checking user authorized or not, by checking cookies consists accessToken
		const token =
			req.cookies?.AccessToken ||
			req.header("Authorization")?.replace("Bearer ", "");
		// console.log(token);
		// throw error if user is not authorized
		if (!token) {
			throw new ApiError(401, "Unauthorized request");
		}

		// verifying accessToken with jwt
		const decodedInformation = jwt.verify(
			req.cookies?.AccessToken,
			process.env.ACCESS_TOKEN_SECRET
		);

		// getting authorized user information
		const user = await User.findById(decodedInformation._id).select(
			"-password -refreshToken"
		);

		// giving error if user is not found or unauthorized
		if (!user) {
			throw new ApiError(401, "Invalid Access Token");
		}

		req.user = user;
		next();
	} catch (error) {
		throw new ApiError(401, error?.message || "Invalid Access Token");
	}
});

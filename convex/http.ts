import { httpRouter } from "convex/server";
import { authComponent, createAuth } from "./auth";
import { stripeWebhook } from "./payments";

const http = httpRouter();

authComponent.registerRoutes(http, createAuth);
http.route({
	path: "/stripe/webhook",
	method: "POST",
	handler: stripeWebhook,
});

export default http;
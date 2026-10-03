import type { Post } from "../posts-types";
import { agentic } from "./agentic";
import { dataSystems } from "./data-systems";
import { pytorch } from "./pytorch";
import { secureSoftware } from "./secure-software";
import { space } from "./space";

export const POSTS: Post[] = [secureSoftware, pytorch, agentic, dataSystems, space];
export const postBySlug = (slug: string) => POSTS.find((p) => p.slug === slug);

export type LectureDifficulty = "beginner" | "intermediate";

export interface MockLecture {
  id: string;
  title: string;
  topic: string;
  estimatedDurationMinutes: number;
  difficulty: LectureDifficulty;
  shortDescription: string;
  fullLectureScript: string;
  previousLessonId?: string;
  nextLessonId?: string;
}

export interface MockCourse {
  id: string;
  title: string;
  description: string;
  lectures: MockLecture[];
}

export const birdBehaviorCourse: MockCourse = {
  id: "bird-behavior-neuroscience",
  title: "Introduction to Bird Behavior and Neuroscience",
  description: "An audio-first course about how birds perceive, learn, communicate, move, and solve problems.",
  lectures: [
    {
      id: "bird-01-migration",
      title: "The Long Journey: How Birds Navigate During Migration",
      topic: "Migration and navigation",
      estimatedDurationMinutes: 12,
      difficulty: "beginner",
      shortDescription: "How inherited direction, the sun, stars, landmarks, and experience guide migration.",
      nextLessonId: "bird-02-magnetic-navigation",
      fullLectureScript: `Welcome to Introduction to Bird Behavior and Neuroscience. In this lesson, we are following a bird on one of the most demanding journeys in nature: migration.

To understand the challenge, imagine leaving home without a road map. You may travel at night, cross places you have never seen, and arrive at a feeding ground thousands of miles away. Some birds do this on their very first migration. Others improve their route over years of travel. So how do they know where to go?

The answer is not a single navigation system. Birds combine several sources of information. Think of it as a layered toolkit. One layer is an inherited program. Young birds of many species begin migrating at roughly the right season, in roughly the right direction, even without following an experienced adult. Experiments with captive birds reveal a behavior called migratory restlessness. At migration time, a bird becomes active at night and repeatedly points in the direction its wild relatives would travel. This tells us that genes can help specify both timing and a basic compass direction.

But an inherited instruction such as fly southwest is not enough for a lifetime of precise travel. Birds also use celestial compasses. During the day, the sun provides direction. Because the sun moves across the sky, a useful sun compass needs an internal clock. A bird must interpret the sun differently in the morning and afternoon. Researchers learned this by shifting birds' internal clocks. When a bird experienced an artificial time shift, its chosen direction also shifted, just as a time-compensated sun compass predicts.

Night migrants can use the stars. Here’s the interesting part: young birds do not appear to memorize one special star. They can learn the pattern of rotation in the night sky. Stars seem to circle around a point near celestial north. In classic planetarium experiments, young birds exposed to a simulated sky learned to orient from that center of rotation. This is a flexible lesson about the structure of the sky, not simply a photograph stored in memory.

Birds also sense broad environmental cues. The direction of polarized light around sunrise and sunset can help calibrate other compasses. Smell is important for some species, especially pigeons and seabirds. Wind, coastlines, rivers, mountain ranges, and city lights can all influence a route. As a bird gains experience, visible landmarks become increasingly useful. An older bird may recognize a valley, shoreline, or road network and make local corrections that a first-year bird cannot.

Navigation also has two different problems. A compass answers, which direction should I fly? A map answers, where am I now relative to my destination? A bird displaced to an unfamiliar location may need both. Young birds relying mostly on an inherited compass may continue in their usual direction. Experienced adults are often better able to compensate, choosing a new direction that leads toward the destination. Their travel history has helped them build a richer map.

The brain supports this combination of instinct, perception, memory, and decision-making. Regions involving the hippocampal formation are important for spatial memory. Visual systems process stars and landmarks. The circadian system supplies time information for the sun compass. Other sensory pathways may carry magnetic or odor information. These systems do not work alone. The bird weighs cues according to weather, time of day, familiarity, and reliability.

Migration is also a problem of energy management. A perfect direction is useless if the bird cannot fuel the trip. Before departure, many migrants store fat, a compact energy source. They may pause at stopover sites to feed and rest. Weather can delay departure, while a favorable tailwind can make a long flight less costly. The route is therefore not always the shortest line. It may be the safest path with dependable food, suitable winds, and fewer barriers.

There is no single answer to the question, how does a bird navigate? A better answer is that birds integrate multiple compasses with memory and an internal sense of time. Young birds begin with inherited guidance. Experience adds landmarks, route knowledge, and better decisions. Sun, stars, smells, magnetic information, and geography can confirm or correct one another.

As you finish this lesson, picture migration not as a bird following an invisible arrow, but as continuous navigation under uncertainty. The bird samples the world, compares signals, and adjusts. In the next lesson, we will focus on the most mysterious part of that toolkit: how birds may sense Earth's magnetic field.`,
    },
    {
      id: "bird-02-magnetic-navigation",
      title: "Magnetic Navigation in Migratory Birds",
      topic: "Magnetoreception",
      estimatedDurationMinutes: 8,
      difficulty: "intermediate",
      shortDescription: "Two leading ideas for how birds detect magnetic direction and position.",
      previousLessonId: "bird-01-migration",
      nextLessonId: "bird-03-landmarks-memory",
      fullLectureScript: `In the last lesson, we explored the many cues birds use during migration. Now let’s focus on one that humans cannot consciously feel: Earth's magnetic field.

Earth behaves roughly like a giant magnet. A compass needle aligns with part of that field, but the field contains more information than north and south. Its lines meet the ground at different angles in different places, and field strength also changes across the planet. A bird could potentially use magnetic direction as a compass and magnetic variation as part of a map.

Scientists have strong behavioral evidence that many birds respond to magnetic fields. In orientation experiments, a migratory bird is placed in a safe circular enclosure where researchers can measure the direction it tries to move. Under a normal field, it tends to point along its seasonal migration direction. When researchers rotate the magnetic field around the enclosure, the bird's preferred direction rotates too. The room has not moved. The stars and walls are the same. Only the magnetic information has changed.

Here’s the interesting part: a bird's magnetic compass is not necessarily like the little compass in a phone. Many songbirds seem to use an inclination compass. Instead of labeling one pole north and the other south, they detect the angle at which magnetic field lines meet Earth's surface. That can distinguish the poleward direction from the equatorward direction. If experimenters reverse the vertical angle of the field, the bird can reverse its orientation even when magnetic north in the ordinary sense has not changed.

How can living tissue detect such a weak force? Two major ideas are being investigated. The first involves light-sensitive chemical reactions in the eye. Proteins called cryptochromes can form pairs of molecules whose chemical behavior may be influenced by a magnetic field. In this model, magnetic direction changes the outcome of a light-dependent reaction. The bird might experience a subtle visual pattern linked to the field's orientation. It would not necessarily see glowing lines. Imagine instead a faint filter over vision that changes as the head turns.

This idea fits several observations. In some species, magnetic orientation works only under certain wavelengths and intensities of light. It also appears sensitive to weak radio-frequency interference, which can disrupt delicate chemical processes. The exact neural experience remains uncertain, but the eye and visual pathways are serious candidates for a magnetic compass.

The second idea involves tiny magnetic particles, often discussed as magnetite. A particle that responds physically to a magnetic field could press or pull on a sensory structure. Researchers have looked for such receptors around the beak and in other tissues. The story is complicated because iron-rich cells may have ordinary immune or storage functions. Scientists are still working to identify a receptor and trace a complete nerve pathway from magnetic force to the brain.

These mechanisms need not do the same job. A light-dependent system might provide compass direction, while a particle-based or other receptor might help measure field intensity for a map. Birds could also calibrate magnetic information against sunset, stars, and landmarks. When cues disagree, the animal may favor the cue that has been most reliable in that setting.

Magnetoreception is a useful lesson in scientific caution. The behavior is real and repeatable in many contexts, but the precise biological sensor is not fully settled. Good science can hold both ideas at once: birds clearly use magnetic information, and we are still discovering how their cells convert that information into perception.

Next time you see a small migrant crossing an open sky, remember that it may be carrying a compass unlike any sense you consciously possess. In our next lesson, we will bring navigation closer to home and ask how visual landmarks and memory help birds find exact places.`,
    },
    {
      id: "bird-03-landmarks-memory",
      title: "Maps in the Mind: Bird Memory and Spatial Navigation",
      topic: "Memory, hippocampus, and spatial behavior",
      estimatedDurationMinutes: 5,
      difficulty: "beginner",
      shortDescription: "How food-storing birds, pigeons, and other species remember places.",
      previousLessonId: "bird-02-magnetic-navigation",
      nextLessonId: "bird-04-song-learning",
      fullLectureScript: `Imagine hiding hundreds of small meals across a neighborhood and returning weeks later to find them. Some birds do something remarkably close to this every year.

Chickadees, jays, nutcrackers, and other food-storing birds cache seeds or insects in many separate locations. They do not recover food by smell alone or by searching randomly. They use spatial memory: information about where a cache lies in relation to rocks, branches, trees, and the wider landscape.

Here’s the interesting part: memory ability often matches a species' ecology. A bird that depends heavily on stored food faces strong pressure to remember many locations. Species and populations with more demanding caching lifestyles may show differences in spatial performance and in the hippocampal formation, a brain region important for spatial memory. This does not mean brain size gives a simple intelligence score. It means neural investment can reflect the problems an animal repeatedly solves.

To understand spatial memory, imagine a cache near a tree. Remembering only turn left at the log can fail if the bird approaches from another direction. A more flexible memory represents relationships among landmarks. The cache is near the tree, beyond a stone, and at a certain position within the area. Birds can use nearby details for precision and distant landmarks for general orientation.

Memory is not perfectly permanent. Landmarks change, snow covers the ground, and other animals steal food. Birds benefit from updating information and forgetting what is no longer useful. Some can remember not just where food was hidden, but what kind of food it was and how long ago it was stored. That matters because a perishable insect and a durable seed should not be treated the same way.

Homing pigeons reveal another scale of spatial learning. On familiar routes, experienced pigeons often follow recognizable landscape features. Their paths can become repeatable, and they can learn efficient local routes. In unfamiliar areas they may rely more on broad cues such as magnetic information, sun, and odors before visual landmarks take over near home.

The main idea is that a bird's internal map is built for action. It guides a beak to a hidden seed, a pigeon to its loft, or a migrant through familiar terrain. Memory connects perception with a goal. It is not a static picture. It is a living model that can be learned, checked, and revised.`,
    },
    {
      id: "bird-04-song-learning",
      title: "How Young Birds Learn Their Songs",
      topic: "Vocal learning and neural development",
      estimatedDurationMinutes: 10,
      difficulty: "intermediate",
      shortDescription: "How listening, practice, feedback, and specialized brain circuits shape birdsong.",
      previousLessonId: "bird-03-landmarks-memory",
      nextLessonId: "bird-05-corvid-intelligence",
      fullLectureScript: `A young songbird does not simply open its beak one morning and produce a perfect adult song. In many species, song develops through listening, memory, practice, and feedback. That makes birdsong one of the most useful animal models for studying learned communication.

Let’s begin with a distinction. Not every bird learns its vocalizations in the same way. Many calls develop largely without tutoring. But in vocal-learning groups, especially songbirds, parrots, and hummingbirds, experience shapes important sounds. A young bird hears a tutor, stores aspects of that song, and gradually adjusts its own output toward the remembered pattern.

The process often includes a sensitive period. Early in life, the bird pays close attention to adult songs, frequently from its father or nearby males. Social interaction can matter. A live tutor may teach more effectively than a recording because the young bird receives attention, timing, and behavioral context. The learner forms an auditory memory, sometimes called a song template.

At first, its own practice can sound unstructured. Researchers compare this early stage to babbling. Notes are variable, sequences are incomplete, and one attempt differs from the next. With practice, the song becomes more stable. In a later plastic-song stage, recognizable syllables emerge but timing and order are still changing. Eventually, many species crystallize a consistent adult song.

Here’s the interesting part: the bird must listen to itself. If a young bird cannot hear its own voice during practice, normal song development is disrupted. It needs auditory feedback to compare what it produced with the stored tutor memory. Imagine practicing a melody while wearing headphones that block your own sound. You could move your mouth correctly and still have trouble correcting pitch and timing.

The bird brain contains specialized networks that support this learning. One pathway is important for producing the learned sequence. Another loop, involving structures often compared functionally with parts of mammalian basal ganglia circuits, helps generate variation and evaluate practice. During learning, variability is useful. It gives the nervous system different attempts to test. Feedback can then strengthen versions that better match the goal.

Adult song is not always fixed forever. Some birds are closed-ended learners and stabilize a repertoire after development. Others are open-ended learners and can add or modify songs later. Seasonal hormones may change how frequently birds sing and how song-control regions operate. The brain remains connected to social life and reproductive timing.

Why learn a local song at all? Song can identify species, defend territory, attract mates, and signal individual quality. Learning allows cultural variation. Groups of the same species can develop dialects, with neighboring birds sharing song features. These dialects can shift over generations as young birds copy some patterns, introduce small changes, and respond to local social pressures.

Birdsong also shows that learning balances imitation with exploration. A bird that copied every sound indiscriminately would not necessarily produce an effective species song. Inherited predispositions focus attention on suitable patterns, while experience fills in local detail. The genes do not specify every note, and the environment does not write on a blank brain. Development comes from their interaction.

There is even evidence that sleep supports song learning. Patterns of neural activity related to song can reappear during sleep, and performance may change from one day to the next. Practice during waking hours is followed by offline processing, much as sleep can help humans consolidate a new skill.

To summarize, a young vocal learner first listens, then practices with variable sounds, compares those sounds with memory, and gradually stabilizes a song. Specialized brain circuits support production, experimentation, and feedback. The result is both biological and cultural: a species-typical signal shaped by the voices in one bird's social world.

The next time you hear a clear bird song, imagine the months of listening and imperfect rehearsal behind it. In the next lesson, we will explore a different kind of flexible behavior: problem-solving in crows and ravens.`,
    },
    {
      id: "bird-05-corvid-intelligence",
      title: "Clever Corvids: Intelligence in Crows and Ravens",
      topic: "Problem-solving and social cognition",
      estimatedDurationMinutes: 15,
      difficulty: "intermediate",
      shortDescription: "What tool use, social memory, caching, and flexible decisions reveal about corvid minds.",
      previousLessonId: "bird-04-song-learning",
      nextLessonId: "bird-06-flight",
      fullLectureScript: `Crows, ravens, jays, and magpies belong to the corvid family. They are famous for clever behavior, but calling an animal intelligent can be vague. A better scientific question is: what problems can it solve, what information does it use, and how flexibly can it change strategy?

Start with tool use. New Caledonian crows use sticks and shaped plant material to extract prey from crevices. They can choose tools with useful properties and, in controlled tasks, sometimes solve problems that require several steps. This does not mean every crow understands tools exactly as a human engineer would. Performance depends on species-typical behavior, experience, and the details of the task. Still, the flexibility is impressive.

To understand why, imagine a piece of food beyond reach. A direct peck fails. The bird must inhibit that immediate response, inspect available objects, select one of suitable length, and use it toward a goal. If the environment changes, success may require choosing a different tool. That combination of inhibition, attention, and flexible action is more informative than simply saying the bird is smart.

Corvid memory is equally important. Many species cache food. A scrub-jay may remember where it stored different foods and recover the items that spoil sooner before the durable ones. Jays also adjust caching when another bird has watched them. A bird may move food later, especially if it has experience stealing caches itself. Researchers debate exactly what the bird understands about the observer's mind, but the behavior clearly uses social information and personal experience.

Here’s the interesting part: corvid intelligence evolved in a brain organized differently from ours. Birds do not have a mammalian neocortex, yet their forebrain contains densely packed neurons and circuits capable of complex cognition. Similar functional challenges can be solved by nervous systems with different anatomical histories. Intelligence is not tied to one blueprint.

Social life creates many challenges. Ravens remember individuals and past interactions. Cooperation can be valuable, but so can caution. A bird may track who is dominant, who shares, and who is likely to steal. In experimental settings, ravens can behave differently depending on whether a competitor can see a food item. Again, scientists are careful not to leap from one behavior to a human-like story. They compare alternative explanations and design tests that separate simple cue learning from more flexible inference.

Corvids also show play. Young ravens manipulate objects, slide on snow, and engage in social games. Play has no single proven purpose, but it may provide practice with movement, objects, and social partners. It creates a low-risk setting where an animal can explore what things do.

Planning is another active area of research. In some experiments, corvids save a tool for a future task or choose an object that will be useful later. The strongest studies control for immediate reward and simple repetition. Results suggest that at least some birds can act for a future situation that differs from the present one. Their planning is not unlimited, but neither is human planning.

What should we conclude from all of this? First, cognition is adapted to ecology. Food caching favors memory. Extracting hidden prey favors object manipulation. Complex social groups favor recognition and strategic behavior. Second, a familiar label such as intelligence contains multiple abilities. Memory, inhibition, causal learning, social awareness, and innovation can vary independently.

We should also avoid ranking all animals on one ladder with humans at the top. A crow will outperform us at remembering scattered cache locations, while we outperform it at many language tasks. Evolution shapes minds for recurring problems. Comparing species is most useful when we ask how each mind works in its own world.

One final image brings these ideas together. Picture a raven watching another raven hide food. It remembers the place, notices who else is present, waits for an opportunity, and may alter its own caching later based on that experience. The behavior combines perception, memory, timing, and social strategy. No single action proves a human-like theory of mind. Together, however, these abilities reveal a flexible and highly capable brain.

Corvids remind us that sophisticated cognition can take flight in a body and brain very different from our own. In the next lesson, we will shift from cognitive flexibility to physical flight and examine how wings generate lift.`,
    },
    {
      id: "bird-06-flight",
      title: "Taking Flight: How Bird Wings Generate Lift",
      topic: "Flight biomechanics",
      estimatedDurationMinutes: 9,
      difficulty: "beginner",
      shortDescription: "How wing shape, airflow, angle, flapping, and feathers produce controlled flight.",
      previousLessonId: "bird-05-corvid-intelligence",
      nextLessonId: "bird-07-flocking",
      fullLectureScript: `Flight can look effortless, but every second in the air is a balance of forces. A flying bird must support its weight, overcome drag, and produce enough forward or upward force to move as intended.

The key upward force is lift. A wing moving through air redirects that air. Because the wing pushes air downward, the air pushes the wing upward. Wing shape and angle help organize this flow. Air pressure tends to be lower over parts of the upper surface and higher below, but it is best to remember the complete physical picture: the wing changes the motion and pressure of surrounding air, producing an upward aerodynamic force.

To understand this, imagine holding your hand out of a moving car window, safely in a thought experiment. Tilt the front edge slightly upward and your hand is pushed up and back. Change the angle too far and the flow separates, making the force less stable. A bird continually adjusts a far more sophisticated surface using joints, muscles, and individual feathers.

A gliding bird trades height for forward motion. Gravity pulls it down, and the wings turn that descent into forward travel while generating lift. A soaring bird gains energy from rising air. Thermals are columns of warm air moving upward. Large birds such as vultures can circle within them, climb without continuous flapping, and then glide toward the next rising region.

Flapping adds power. During a typical downstroke, the wing moves down and forward in a way that produces both lift and thrust. The upstroke varies with speed and species. At slow speeds, some birds partly fold or rotate the wing to reduce resistance. Small birds and hovering specialists use complex motions that continue producing useful force through much of the cycle.

Here’s the interesting part: a wing is not a rigid airplane wing. The bird changes its shape from moment to moment. It can spread the primary feathers at the wingtip, creating slots that reduce certain airflow losses at low speed. It can alter camber, which is the curve of the wing, and change angle of attack. The tail can add stability, braking, and steering.

Different wing shapes suit different lifestyles. Long, narrow wings are efficient for gliding over oceans. Broad, slotted wings help large land birds soar and maneuver at lower speeds. Short, rounded wings can support rapid takeoff and tight turns in forests. Pointed wings are common in fast, sustained fliers. No shape is best for every job; each reflects tradeoffs among speed, endurance, maneuverability, and takeoff.

Feathers make these adjustable surfaces possible. Flight feathers overlap to form a continuous wing, yet they can twist and separate under changing pressure. Tiny hooked structures help neighboring feather branches hold together. Birds maintain the surface by preening, realigning feather parts and distributing oils where appropriate.

Takeoff and landing are especially demanding. To take off, a bird may jump, run, face into the wind, or drop from a perch. Landing requires reducing speed while maintaining control. The bird raises its body angle, spreads wings and tail, and extends its feet. This increases drag and briefly creates strong lift, like an aerodynamic flare.

Flight is therefore not caused by one magical wing shape. It emerges from motion, airflow, muscle power, feathers, and continuous control. A bird is sensing gusts and adjusting many parts at once. What looks effortless is an active conversation between the body and the air.`,
    },
    {
      id: "bird-07-flocking",
      title: "Moving as One: Why Birds Flock Together",
      topic: "Collective behavior",
      estimatedDurationMinutes: 4,
      difficulty: "beginner",
      shortDescription: "How simple local responses create coordinated flocks and provide safety and information.",
      previousLessonId: "bird-06-flight",
      nextLessonId: "bird-08-sleep",
      fullLectureScript: `A flock can turn so quickly that it seems to share one mind. Yet there is usually no leader issuing commands to every bird. Coordinated motion can emerge from local decisions.

To understand this, imagine that each bird follows a few practical tendencies. Stay near neighbors so you do not become isolated. Avoid getting so close that you collide. Match the direction and speed of nearby birds. Each bird responds mostly to a limited set of neighbors, and the result can spread across the flock like a wave.

Flocking offers several benefits. Safety is one. More eyes can detect a predator sooner. Once danger appears, the moving group can make it difficult for a predator to track one target. An individual can also reduce its chance of being the animal closest to danger by staying within the group.

Groups can share information about food. If one bird discovers a useful feeding area, others may notice its movement or success. Roosts can become information centers where birds observe which individuals returned well fed. But flocking also creates competition, noise, and a greater chance of disease transmission. The useful group size depends on the situation.

Some formations save energy. Large birds flying in a V can position themselves to benefit from upward-moving air near the wingtip of the bird ahead. They may take turns in costly lead positions. This is different from a dense starling murmuration, where rapid predator avoidance and local coordination dominate.

Here’s the interesting part: complex beauty does not always require complex instructions. Small adjustments repeated by many individuals can create a sweeping, responsive pattern. The flock is organized, but the organization is distributed across the birds.`,
    },
    {
      id: "bird-08-sleep",
      title: "Half Awake: Sleep in the Bird Brain",
      topic: "Sleep and unihemispheric sleep",
      estimatedDurationMinutes: 8,
      difficulty: "intermediate",
      shortDescription: "How birds sleep, why one hemisphere may rest at a time, and what sleep costs and protects.",
      previousLessonId: "bird-07-flocking",
      nextLessonId: "bird-09-feathers",
      fullLectureScript: `Birds need sleep, but sleeping can be dangerous. A sleeping animal detects predators slowly, cannot forage, and may lose position in a group. Bird sleep therefore reveals a fascinating balance between restoration and vigilance.

Like mammals, birds show different sleep states. Slow-wave sleep involves synchronized patterns of brain activity. Birds also show rapid-eye-movement sleep, although individual episodes can be brief. During REM sleep, muscle tone changes and the head may droop before the bird quickly restores posture.

Here’s the interesting part: some birds can sleep with one brain hemisphere more deeply asleep than the other. This is called unihemispheric slow-wave sleep. The eye connected mainly to the more awake hemisphere can remain open. A bird at the edge of a group may direct that open eye away from the flock, where a predator is more likely to appear.

To understand the advantage, imagine being able to rest half of your brain while the other half keeps watch. The two hemispheres can alternate, allowing some recovery without complete disconnection from the surroundings. This ability is especially useful in exposed settings and may also help certain birds maintain control during long periods of movement.

Evidence suggests that some flying birds can sleep while airborne. Great frigatebirds carrying brain-activity recorders showed brief sleep episodes during multi-day flights, including unihemispheric and short bihemispheric sleep. They slept far less in flight than on land, which shows both the flexibility of sleep and the likely cost of postponing it.

Not all bird sleep is half-brain sleep, and birds do not use it continuously. When conditions are safe, deeper sleep involving both hemispheres may provide better restoration. A bird can adjust vigilance according to its place in a group, perceived risk, and physical needs.

Sleep also supports learning and brain maintenance. In young songbirds, neural patterns related to singing can appear during sleep, and song performance changes across days of practice and rest. Sleep may help consolidate motor and auditory learning. More broadly, it allows neural systems to regulate activity and recover, though researchers continue to investigate its many functions.

Bird posture adds another puzzle: how does a perched bird avoid falling? Tendons in the legs can help the toes remain flexed around a branch when the legs bend. This reduces the muscular effort needed to grip through the night. Different species also choose protected cavities, dense foliage, water, cliffs, or communal roosts to manage temperature and danger.

Sleep is not simply an on-off switch. It is a flexible biological state. Birds can change depth, hemisphere, posture, timing, and location. Unihemispheric sleep is the clearest example of the tradeoff: enough awareness to survive, enough sleep to keep the brain working.`,
    },
    {
      id: "bird-09-feathers",
      title: "More Than Flight: The Evolution and Function of Feathers",
      topic: "Feather evolution and function",
      estimatedDurationMinutes: 5,
      difficulty: "beginner",
      shortDescription: "How feathers evolved and became tools for insulation, display, sensing, protection, and flight.",
      previousLessonId: "bird-08-sleep",
      nextLessonId: "bird-10-communication",
      fullLectureScript: `Feathers are strongly associated with flight, but they did not begin as finished airplane surfaces. Fossils show that feather-like structures evolved among dinosaurs before the origin of modern birds, and many feathered species were not capable of powered flight.

Early simple filaments may have helped with insulation or display. Over evolutionary time, branching structures became more complex. A modern contour feather has a central shaft with branches called barbs. Smaller barbules can hook together, creating a light but coherent surface. This branching design can be modified into fluffy down, stiff flight feathers, waterproofing structures, or decorative plumes.

Here’s the interesting part: evolution often repurposes existing structures. A feather useful for keeping warm can later be shaped by selection for display, gliding, or flight. Once aerodynamic feathers existed, changes in the forelimb, skeleton, muscles, and nervous control could interact with them.

Feathers still perform many jobs. Down traps air near the body and reduces heat loss. Contour feathers shape and protect the body surface. Wing and tail feathers generate and control aerodynamic forces. Color patterns hide birds from predators, identify species, or attract mates. Some feathers help shed water, make sound, or sense changes in feather position.

Color can come from pigments or microscopic structure. Melanin produces many blacks and browns and can strengthen feather material. Carotenoid pigments, often obtained through diet, contribute yellows, oranges, and reds. Structural colors arise when tiny arrangements within the feather interact with light. Iridescent colors change with viewing angle because the physical structure reflects different wavelengths in different directions.

Feathers wear out. Birds replace them through molt, often on schedules that avoid losing too much flight ability at once. Growing a feather requires energy, but once complete it is dead tissue. That is why a damaged feather cannot heal like skin. Preening helps keep feathers aligned and functional until replacement.

A feather is therefore not one invention for one purpose. It is a versatile biological material shaped across millions of years. Warmth, signaling, protection, sensing, and flight all meet in the same elegant structure.`,
    },
    {
      id: "bird-10-communication",
      title: "Signals in the Sky: Bird Communication and Courtship",
      topic: "Communication and mating signals",
      estimatedDurationMinutes: 13,
      difficulty: "intermediate",
      shortDescription: "How sound, color, movement, honesty, and social context shape bird signals.",
      previousLessonId: "bird-09-feathers",
      fullLectureScript: `Birds communicate through sound, color, posture, movement, touch, and sometimes scent. A signal is not merely something noticeable. In biology, it is a trait or action shaped to influence another animal, and the receiver's response is part of the system.

Consider a song at dawn. It may tell rivals that a territory is occupied and tell potential mates that the singer is present. The same sound can carry several kinds of information: species identity, individual identity, location, motivation, and perhaps aspects of condition. Meaning depends on who hears it and in what context.

Calls often serve immediate functions. Alarm calls can warn about predators. Contact calls help flock members stay together. Begging calls influence parents. Some species use different alarm patterns in different situations, and listeners combine the call with their own view of the environment. Communication is not a simple dictionary. It is information interpreted in context.

Courtship signals can become spectacular. A bird-of-paradise clears a display area and performs precise movements. A bowerbird arranges objects around a structure. Other birds inflate feathers, drum on trees, snap wings, or make sounds with specialized feathers. These displays can show species identity and allow mate choice.

Here’s the interesting part: a signal can remain reliable even when the sender benefits from exaggerating. Reliability may come from cost or constraint. A complex song might require learning and motor control. Bright coloration may depend partly on access to nutrients or the ability to maintain feathers. A vigorous dance can reveal coordination and stamina. The signal does not need to be a perfect report card; it only needs to correlate with something the receiver benefits from assessing.

Some signals are conventional rather than physically costly. A small badge of color can indicate social status if group members punish dishonest use. Reliability then depends on the social consequences of bluffing. In other cases, the structure of the signal itself makes dishonesty difficult. A very low call may be easier for a large-bodied animal to produce, although birds can also evolve structures that complicate such simple relationships.

Receivers shape signal evolution. If females prefer a particular color or rhythm, males with that trait may reproduce more. Over generations, preferences and signals can influence each other. But natural selection imposes limits. A display that attracts mates may also attract predators or require time that could have been spent feeding.

The environment changes which signals work. Low-frequency sounds may travel differently through dense vegetation than rapid high notes. Urban noise can mask parts of a song, and some birds adjust pitch, timing, or amplitude. Visual displays depend on lighting and background. A color that stands out in open sunlight may appear different beneath a forest canopy.

Communication can also involve deception. A bird may give a false alarm and use the confusion to steal food, but frequent dishonesty can reduce trust. Other species eavesdrop on signals not directed at them. A chickadee alarm can recruit several species that recognize the warning. Predators, rivals, and potential mates may all listen to the same performance.

The brain must turn these signals into decisions. Auditory pathways separate timing, pitch, and pattern. Visual systems process color and motion. Memory helps identify neighbors or familiar mates. Hormones and season change how strongly an animal responds. A song that is ignored in winter may trigger territorial behavior in spring.

Bird communication is therefore a relationship, not just a sound or ornament. A sender produces a signal in a physical and social environment. A receiver detects it, combines it with context and memory, and acts. That response changes which signals succeed in the future.

As this course closes, notice how its themes connect. Migration combines senses with memory. Song learning combines inherited biases with experience. Flocking emerges from social responses. Courtship links feathers, movement, perception, and choice. Bird behavior is not a collection of isolated tricks. It is the visible result of brains and bodies solving problems in a changing world.`,
    },
  ],
};

export const birdLectureById = new Map(birdBehaviorCourse.lectures.map((lecture) => [lecture.id, lecture]));

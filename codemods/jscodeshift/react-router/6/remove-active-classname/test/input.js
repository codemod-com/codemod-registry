const MyApp = ({ title }) => {
	return (
		<NavLink
			to="/messages"
			className="nav-link"
			activeClassName="activated"
		>
			Messages
		</NavLink>
	);
};

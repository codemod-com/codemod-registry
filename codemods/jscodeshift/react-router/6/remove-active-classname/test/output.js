const MyApp = ({ title }) => {
	return (
		<NavLink
			to="/messages"
			className={({ isActive: isActive }) =>
				'nav-link' + (isActive ? ' activated' : '')
			}
		>
			Messages
		</NavLink>
	);
};
